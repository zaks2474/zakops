'use client';

import { IconX, IconUpload } from '@tabler/icons-react';
import Image from 'next/image';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useControllableState } from '@/hooks/use-controllable-state';
import { cn, formatBytes } from '@/lib/utils';

export interface FileUploaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Value of the uploader.
   * @type File[]
   * @default undefined
   * @example value={files}
   */
  value?: File[];

  /**
   * Function to be called when the value changes.
   * @type React.Dispatch<React.SetStateAction<File[]>>
   * @default undefined
   * @example onValueChange={(files) => setFiles(files)}
   */
  onValueChange?: React.Dispatch<React.SetStateAction<File[]>>;

  /**
   * Function to be called when files are uploaded.
   * @type (files: File[]) => Promise<void>
   * @default undefined
   * @example onUpload={(files) => uploadFiles(files)}
   */
  onUpload?: (files: File[]) => Promise<void>;

  /**
   * Progress of the uploaded files.
   * @type Record<string, number> | undefined
   * @default undefined
   * @example progresses={{ "file1.png": 50 }}
   */
  progresses?: Record<string, number>;

  /**
   * Accepted file types for the uploader.
   * @type { [key: string]: string[]}
   * @default
   * ```ts
   * { "image/*": [] }
   * ```
   * @example accept={["image/png", "image/jpeg"]}
   */
  accept?: Record<string, string[]> | string[] | string;

  /**
   * Maximum file size for the uploader.
   * @type number | undefined
   * @default 1024 * 1024 * 2 // 2MB
   * @example maxSize={1024 * 1024 * 2} // 2MB
   */
  maxSize?: number;

  /**
   * Maximum number of files for the uploader.
   * @type number | undefined
   * @default 1
   * @example maxFiles={5}
   */
  maxFiles?: number;

  /**
   * Whether the uploader should accept multiple files.
   * @type boolean
   * @default false
   * @example multiple
   */
  multiple?: boolean;

  /**
   * Whether the uploader is disabled.
   * @type boolean
   * @default false
   * @example disabled
   */
  disabled?: boolean;
}

type FileRejection = {
  file: File;
  reason: string;
};

export function FileUploader(props: FileUploaderProps) {
  const {
    value: valueProp,
    onValueChange,
    onUpload,
    progresses,
    accept = { 'image/*': [] },
    maxSize = 1024 * 1024 * 2,
    maxFiles = 1,
    multiple = false,
    disabled = false,
    className,
    ...rootProps
  } = props;

  const [files, setFiles] = useControllableState({
    prop: valueProp,
    onChange: onValueChange
  });

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);

  const acceptAttr = React.useMemo(() => {
    if (!accept) return undefined;
    if (Array.isArray(accept)) return accept.join(',');
    if (typeof accept === 'string') return accept;
    if (typeof accept === 'object') return Object.keys(accept).join(',');
    return undefined;
  }, [accept]);

  const isAccepted = React.useCallback(
    (file: File) => {
      if (!accept) return true;
      const patterns = Array.isArray(accept)
        ? accept
        : typeof accept === 'string'
          ? [accept]
          : Object.keys(accept);

      if (patterns.length === 0) return true;
      const name = (file.name || '').toLowerCase();
      const mime = (file.type || '').toLowerCase();

      return patterns.some((p) => {
        const pat = (p || '').toLowerCase().trim();
        if (!pat) return false;
        if (pat.startsWith('.')) return name.endsWith(pat);
        if (pat.endsWith('/*')) return mime.startsWith(pat.slice(0, -1));
        if (mime) return mime === pat;
        return false;
      });
    },
    [accept]
  );

  const onDrop = React.useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (!multiple && maxFiles === 1 && acceptedFiles.length > 1) {
        toast.error('Cannot upload more than 1 file at a time');
        return;
      }

      if ((files?.length ?? 0) + acceptedFiles.length > maxFiles) {
        toast.error(`Cannot upload more than ${maxFiles} files`);
        return;
      }

      const newFiles = acceptedFiles.map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file)
        })
      );

      const updatedFiles = files ? [...files, ...newFiles] : newFiles;

      setFiles(updatedFiles);

      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach(({ file, reason }) => {
          toast.error(`File ${file.name} was rejected${reason ? `: ${reason}` : ''}`);
        });
      }

      if (
        onUpload &&
        updatedFiles.length > 0 &&
        updatedFiles.length <= maxFiles
      ) {
        const target =
          updatedFiles.length > 0 ? `${updatedFiles.length} files` : `file`;

        toast.promise(onUpload(updatedFiles), {
          loading: `Uploading ${target}...`,
          success: () => {
            setFiles([]);
            return `${target} uploaded`;
          },
          error: `Failed to upload ${target}`
        });
      }
    },

    [files, maxFiles, multiple, onUpload, setFiles]
  );

  const handleFiles = React.useCallback(
    (incoming: File[]) => {
      const accepted: File[] = [];
      const rejected: FileRejection[] = [];

      for (const file of incoming) {
        if (maxSize && file.size > maxSize) {
          rejected.push({ file, reason: `exceeds max size (${formatBytes(maxSize)})` });
          continue;
        }
        if (!isAccepted(file)) {
          rejected.push({ file, reason: 'type not accepted' });
          continue;
        }
        accepted.push(file);
      }

      onDrop(accepted, rejected);
    },
    [isAccepted, maxSize, onDrop]
  );

  function onRemove(index: number) {
    if (!files) return;
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onValueChange?.(newFiles);
  }

  // Revoke preview url when component unmounts
  React.useEffect(() => {
    return () => {
      if (!files) return;
      files.forEach((file) => {
        if (isFileWithPreview(file)) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDisabled = disabled || (files?.length ?? 0) >= maxFiles;

  return (
    <div className='relative flex flex-col gap-6 overflow-hidden'>
      <div
        role='button'
        tabIndex={0}
        onKeyDown={(e) => {
          if (isDisabled) return;
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onClick={() => {
          if (isDisabled) return;
          inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isDisabled) return;
          setIsDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isDisabled) return;
          setIsDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragActive(false);
          if (isDisabled) return;
          const dropped = Array.from(e.dataTransfer.files || []);
          if (dropped.length > 0) handleFiles(dropped);
        }}
        className={cn(
          'group border-muted-foreground/25 hover:bg-muted/25 relative grid h-52 w-full cursor-pointer place-items-center rounded-lg border-2 border-dashed px-5 py-2.5 text-center transition',
          'ring-offset-background focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
          isDragActive && 'border-muted-foreground/50',
          isDisabled && 'pointer-events-none opacity-60',
          className
        )}
        {...rootProps}
      >
        <input
          ref={inputRef}
          type='file'
          className='hidden'
          accept={acceptAttr}
          multiple={maxFiles > 1 || multiple}
          disabled={isDisabled}
          onChange={(e) => {
            const picked = Array.from(e.target.files || []);
            e.target.value = '';
            if (picked.length > 0) handleFiles(picked);
          }}
        />
        {isDragActive ? (
          <div className='flex flex-col items-center justify-center gap-4 sm:px-5'>
            <div className='rounded-full border border-dashed p-3'>
              <IconUpload className='text-muted-foreground size-7' aria-hidden='true' />
            </div>
            <p className='text-muted-foreground font-medium'>Drop the files here</p>
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center gap-4 sm:px-5'>
            <div className='rounded-full border border-dashed p-3'>
              <IconUpload className='text-muted-foreground size-7' aria-hidden='true' />
            </div>
            <div className='space-y-px'>
              <p className='text-muted-foreground font-medium'>
                Drag {`'n'`} drop files here, or click to select files
              </p>
              <p className='text-muted-foreground/70 text-sm'>
                You can upload
                {maxFiles > 1
                  ? ` ${maxFiles === Infinity ? 'multiple' : maxFiles}
                  files (up to ${formatBytes(maxSize)} each)`
                  : ` a file with ${formatBytes(maxSize)}`}
              </p>
            </div>
          </div>
        )}
      </div>
      {files?.length ? (
        <ScrollArea className='h-fit w-full px-3'>
          <div className='max-h-48 space-y-4'>
            {files?.map((file, index) => (
              <FileCard
                key={index}
                file={file}
                onRemove={() => onRemove(index)}
                progress={progresses?.[file.name]}
              />
            ))}
          </div>
        </ScrollArea>
      ) : null}
    </div>
  );
}

interface FileCardProps {
  file: File;
  onRemove: () => void;
  progress?: number;
}

function FileCard({ file, progress, onRemove }: FileCardProps) {
  return (
    <div className='relative flex items-center space-x-4'>
      <div className='flex flex-1 space-x-4'>
        {isFileWithPreview(file) ? (
          <Image
            src={file.preview}
            alt={file.name}
            width={48}
            height={48}
            loading='lazy'
            className='aspect-square shrink-0 rounded-md object-cover'
          />
        ) : null}
        <div className='flex w-full flex-col gap-2'>
          <div className='space-y-px'>
            <p className='text-foreground/80 line-clamp-1 text-sm font-medium'>
              {file.name}
            </p>
            <p className='text-muted-foreground text-xs'>
              {formatBytes(file.size)}
            </p>
          </div>
          {progress ? <Progress value={progress} /> : null}
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={onRemove}
          disabled={progress !== undefined && progress < 100}
          className='size-8 rounded-full'
        >
          <IconX className='text-muted-foreground' />
          <span className='sr-only'>Remove file</span>
        </Button>
      </div>
    </div>
  );
}

function isFileWithPreview(file: File): file is File & { preview: string } {
  return 'preview' in file && typeof file.preview === 'string';
}

'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import type { InputSchema, SchemaProperty } from '@/lib/api';

interface ActionInputFormProps {
  schema: InputSchema;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  disabled?: boolean;
  showDescriptions?: boolean;
}

/**
 * Schema-Driven Form Component
 *
 * Renders form inputs dynamically based on JSON Schema-like input_schema
 * from capability manifests. Supports:
 * - string (input, textarea, enum select)
 * - number (input type number)
 * - boolean (checkbox)
 * - date (date input)
 * - enum (select dropdown)
 * - nested objects (recursively)
 * - arrays (basic support)
 */
export function ActionInputForm({
  schema,
  values,
  onChange,
  disabled = false,
  showDescriptions = true,
}: ActionInputFormProps) {
  const requiredFields = new Set(schema.required || []);

  const handleChange = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  const renderField = (key: string, prop: SchemaProperty, path: string = key) => {
    const currentValue = values[path];
    const isRequired = requiredFields.has(key) || prop.required;
    const fieldLabel = formatLabel(key);

    // Handle enum fields (select dropdown)
    if (prop.enum && prop.enum.length > 0) {
      return (
        <div key={path} className="space-y-2">
          <Label htmlFor={path} className="flex items-center gap-1">
            {fieldLabel}
            {isRequired && <span className="text-destructive">*</span>}
          </Label>
          <Select
            value={(currentValue as string) || (prop.default as string) || '__empty__'}
            onValueChange={(v) => handleChange(path, v === '__empty__' ? '' : v)}
            disabled={disabled}
          >
            <SelectTrigger id={path}>
              <SelectValue placeholder={`Select ${fieldLabel.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {!isRequired && (
                <SelectItem value="__empty__">
                  <span className="text-muted-foreground">None</span>
                </SelectItem>
              )}
              {prop.enum.map((option) => (
                <SelectItem key={option} value={option}>
                  {formatLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showDescriptions && prop.description && (
            <p className="text-xs text-muted-foreground">{prop.description}</p>
          )}
        </div>
      );
    }

    // Handle by type
    switch (prop.type) {
      case 'string':
        // Long text fields use textarea
        const usesTextarea =
          key.includes('context') ||
          key.includes('description') ||
          key.includes('content') ||
          key.includes('assumptions') ||
          prop.maxLength && prop.maxLength > 200;

        if (usesTextarea) {
          return (
            <div key={path} className="space-y-2">
              <Label htmlFor={path} className="flex items-center gap-1">
                {fieldLabel}
                {isRequired && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id={path}
                value={(currentValue as string) || (prop.default as string) || ''}
                onChange={(e) => handleChange(path, e.target.value)}
                disabled={disabled}
                placeholder={prop.description || `Enter ${fieldLabel.toLowerCase()}`}
                rows={4}
                minLength={prop.minLength}
                maxLength={prop.maxLength}
              />
              {showDescriptions && prop.description && (
                <p className="text-xs text-muted-foreground">{prop.description}</p>
              )}
            </div>
          );
        }

        // Date format
        if (prop.format === 'date' || prop.format === 'date-time') {
          return (
            <div key={path} className="space-y-2">
              <Label htmlFor={path} className="flex items-center gap-1">
                {fieldLabel}
                {isRequired && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id={path}
                type={prop.format === 'date-time' ? 'datetime-local' : 'date'}
                value={(currentValue as string) || ''}
                onChange={(e) => handleChange(path, e.target.value)}
                disabled={disabled}
              />
              {showDescriptions && prop.description && (
                <p className="text-xs text-muted-foreground">{prop.description}</p>
              )}
            </div>
          );
        }

        // Email format
        if (prop.format === 'email' || key.includes('email')) {
          return (
            <div key={path} className="space-y-2">
              <Label htmlFor={path} className="flex items-center gap-1">
                {fieldLabel}
                {isRequired && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id={path}
                type="email"
                value={(currentValue as string) || (prop.default as string) || ''}
                onChange={(e) => handleChange(path, e.target.value)}
                disabled={disabled}
                placeholder={prop.description || `Enter ${fieldLabel.toLowerCase()}`}
              />
              {showDescriptions && prop.description && (
                <p className="text-xs text-muted-foreground">{prop.description}</p>
              )}
            </div>
          );
        }

        // Regular string input
        return (
          <div key={path} className="space-y-2">
            <Label htmlFor={path} className="flex items-center gap-1">
              {fieldLabel}
              {isRequired && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={path}
              type="text"
              value={(currentValue as string) || (prop.default as string) || ''}
              onChange={(e) => handleChange(path, e.target.value)}
              disabled={disabled}
              placeholder={prop.description || `Enter ${fieldLabel.toLowerCase()}`}
              minLength={prop.minLength}
              maxLength={prop.maxLength}
            />
            {showDescriptions && prop.description && (
              <p className="text-xs text-muted-foreground">{prop.description}</p>
            )}
          </div>
        );

      case 'number':
      case 'integer':
        return (
          <div key={path} className="space-y-2">
            <Label htmlFor={path} className="flex items-center gap-1">
              {fieldLabel}
              {isRequired && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={path}
              type="number"
              value={(currentValue as number) ?? (prop.default as number) ?? ''}
              onChange={(e) => handleChange(path, e.target.value ? Number(e.target.value) : null)}
              disabled={disabled}
              placeholder={prop.description}
              min={prop.minimum}
              max={prop.maximum}
            />
            {showDescriptions && prop.description && (
              <p className="text-xs text-muted-foreground">{prop.description}</p>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={path} className="flex items-start space-x-3 py-2">
            <Checkbox
              id={path}
              checked={(currentValue as boolean) ?? (prop.default as boolean) ?? false}
              onCheckedChange={(checked) => handleChange(path, checked)}
              disabled={disabled}
            />
            <div className="space-y-1">
              <Label htmlFor={path} className="cursor-pointer">
                {fieldLabel}
                {isRequired && <span className="text-destructive ml-1">*</span>}
              </Label>
              {showDescriptions && prop.description && (
                <p className="text-xs text-muted-foreground">{prop.description}</p>
              )}
            </div>
          </div>
        );

      case 'object':
        if (prop.properties) {
          return (
            <Card key={path} className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{fieldLabel}</CardTitle>
                {prop.description && (
                  <CardDescription>{prop.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(prop.properties).map(([nestedKey, nestedProp]) =>
                  renderField(nestedKey, nestedProp as SchemaProperty, `${path}.${nestedKey}`)
                )}
              </CardContent>
            </Card>
          );
        }
        return null;

      case 'array':
        // Basic array support - render as comma-separated textarea
        return (
          <div key={path} className="space-y-2">
            <Label htmlFor={path} className="flex items-center gap-1">
              {fieldLabel}
              {isRequired && <span className="text-destructive">*</span>}
              <Badge variant="secondary" className="ml-2 text-xs">list</Badge>
            </Label>
            <Textarea
              id={path}
              value={Array.isArray(currentValue) ? currentValue.join('\n') : ''}
              onChange={(e) => handleChange(path, e.target.value.split('\n').filter(Boolean))}
              disabled={disabled}
              placeholder="Enter one item per line"
              rows={3}
            />
            {showDescriptions && prop.description && (
              <p className="text-xs text-muted-foreground">{prop.description}</p>
            )}
          </div>
        );

      default:
        // Unknown type - render as text input with warning
        return (
          <div key={path} className="space-y-2">
            <Label htmlFor={path} className="flex items-center gap-1">
              {fieldLabel}
              <Badge variant="outline" className="ml-2 text-xs">
                {prop.type}
              </Badge>
            </Label>
            <Input
              id={path}
              type="text"
              value={String(currentValue || prop.default || '')}
              onChange={(e) => handleChange(path, e.target.value)}
              disabled={disabled}
            />
            {showDescriptions && prop.description && (
              <p className="text-xs text-muted-foreground">{prop.description}</p>
            )}
          </div>
        );
    }
  };

  const properties = schema.properties || {};

  if (Object.keys(properties).length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <IconInfoCircle className="h-4 w-4" />
        <span>No inputs required for this action</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(properties).map(([key, prop]) =>
        renderField(key, prop as SchemaProperty)
      )}
    </div>
  );
}

/**
 * Format a key like "document_type" or "recipientEmail" to "Document Type" or "Recipient Email"
 */
function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Read-only display of action inputs (for completed/failed actions)
 * Fixed to properly handle overflow and render objects/arrays correctly
 */
export function ActionInputDisplay({
  inputs,
  schema,
}: {
  inputs: Record<string, unknown>;
  schema?: InputSchema;
}) {
  if (!inputs || Object.keys(inputs).length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No inputs</p>
    );
  }

  return (
    <div className="space-y-3">
      {Object.entries(inputs).map(([key, value]) => {
        const prop = schema?.properties?.[key] as SchemaProperty | undefined;
        return (
          <div key={key} className="space-y-1">
            {/* Label */}
            <span className="text-xs text-muted-foreground uppercase tracking-wider block">
              {formatLabel(key)}
            </span>
            {/* Value - with proper overflow handling */}
            <div className="bg-muted/50 rounded px-2 py-1.5 min-w-0 overflow-hidden">
              {renderDisplayValue(value, prop)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Render a value for display with proper formatting and overflow handling
 */
function renderDisplayValue(value: unknown, prop?: SchemaProperty): React.ReactNode {
  // Null/undefined
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic text-sm">-</span>;
  }

  // Boolean
  if (typeof value === 'boolean') {
    return <span className="text-sm font-medium">{value ? 'Yes' : 'No'}</span>;
  }

  // Array - render each item properly
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground italic text-sm">Empty list</span>;
    }
    return (
      <div className="space-y-1">
        {value.map((item, i) => (
          <div key={i} className="text-sm break-all">
            {typeof item === 'object' && item !== null ? (
              <pre className="text-xs whitespace-pre-wrap break-all overflow-x-auto">
                {JSON.stringify(item, null, 2)}
              </pre>
            ) : (
              <span>{String(item)}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Object - format as JSON
  if (typeof value === 'object') {
    return (
      <pre className="text-sm whitespace-pre-wrap break-all overflow-x-auto max-h-40 overflow-y-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  // String - handle different types
  const strValue = String(value);

  // Check if it's a file path
  if (strValue.startsWith('/') || strValue.includes('/home/')) {
    return (
      <code className="text-sm text-emerald-500 break-all block">
        {strValue}
      </code>
    );
  }

  // Regular string value
  return (
    <span className="text-sm break-all block">
      {strValue}
    </span>
  );
}

/**
 * Validate form values against schema
 */
export function validateFormValues(
  values: Record<string, unknown>,
  schema: InputSchema
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const requiredFields = schema.required || [];

  for (const key of requiredFields) {
    const value = values[key];
    if (value === undefined || value === null || value === '') {
      errors.push(`${formatLabel(key)} is required`);
    }
  }

  // Check individual property requirements
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    const property = prop as SchemaProperty;
    const value = values[key];

    if (property.required && (value === undefined || value === null || value === '')) {
      if (!errors.some(e => e.includes(formatLabel(key)))) {
        errors.push(`${formatLabel(key)} is required`);
      }
    }

    // Type-specific validation
    if (value !== undefined && value !== null && value !== '') {
      if (property.type === 'string' && typeof value === 'string') {
        if (property.minLength && value.length < property.minLength) {
          errors.push(`${formatLabel(key)} must be at least ${property.minLength} characters`);
        }
        if (property.maxLength && value.length > property.maxLength) {
          errors.push(`${formatLabel(key)} must be at most ${property.maxLength} characters`);
        }
      }

      if ((property.type === 'number' || property.type === 'integer') && typeof value === 'number') {
        if (property.minimum !== undefined && value < property.minimum) {
          errors.push(`${formatLabel(key)} must be at least ${property.minimum}`);
        }
        if (property.maximum !== undefined && value > property.maximum) {
          errors.push(`${formatLabel(key)} must be at most ${property.maximum}`);
        }
      }

      if (property.enum && !property.enum.includes(value as string)) {
        errors.push(`${formatLabel(key)} must be one of: ${property.enum.join(', ')}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

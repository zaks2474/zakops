/**
 * PreferencesStep Component
 *
 * Set notification and UI preferences.
 * Expanded to include granular notification controls.
 */

'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  IconMail,
  IconBell,
  IconCalendar,
  IconShieldCheck,
  IconChartBar,
  IconRobot,
  IconMoon,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface NotificationPrefs {
  email: boolean;
  browser: boolean;
  digest: 'daily' | 'weekly' | 'none';
  // Expanded preferences
  approvalAlerts?: 'all' | 'critical' | 'none';
  dealStageChanges?: boolean;
  agentActivity?: boolean;
  quietHours?: {
    enabled: boolean;
    start: string; // "22:00"
    end: string; // "08:00"
  };
}

interface PreferencesStepProps {
  notifications: NotificationPrefs;
  onUpdate: (notifications: NotificationPrefs) => void;
}

// =============================================================================
// Component
// =============================================================================

export function PreferencesStep({ notifications, onUpdate }: PreferencesStepProps) {
  const updatePref = <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
    onUpdate({ ...notifications, [key]: value });
  };

  // Initialize defaults for expanded preferences
  const approvalAlerts = notifications.approvalAlerts ?? 'all';
  const dealStageChanges = notifications.dealStageChanges ?? true;
  const agentActivity = notifications.agentActivity ?? true;
  const quietHours = notifications.quietHours ?? { enabled: false, start: '22:00', end: '08:00' };

  return (
    <div className="space-y-6">
      {/* Core notification channels */}
      <div>
        <h3 className="text-sm font-medium mb-4">Notification Channels</h3>
        <div className="space-y-3">
          {/* Email notifications */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <IconMail className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="email-notif" className="font-medium">
                  Email Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about pending approvals and deal updates
                </p>
              </div>
            </div>
            <Switch
              id="email-notif"
              checked={notifications.email}
              onCheckedChange={(checked) => updatePref('email', checked)}
            />
          </div>

          {/* Browser notifications */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <IconBell className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="browser-notif" className="font-medium">
                  Browser Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Real-time alerts for urgent items
                </p>
              </div>
            </div>
            <Switch
              id="browser-notif"
              checked={notifications.browser}
              onCheckedChange={(checked) => updatePref('browser', checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* What to notify about */}
      <div>
        <h3 className="text-sm font-medium mb-4">What to Notify About</h3>
        <div className="space-y-3">
          {/* Approval alerts level */}
          <div className="p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-3">
              <IconShieldCheck className="w-4 h-4 text-muted-foreground" />
              <Label className="font-medium">Approval Alerts</Label>
            </div>
            <RadioGroup
              value={approvalAlerts}
              onValueChange={(value) => updatePref('approvalAlerts', value as 'all' | 'critical' | 'none')}
              className="space-y-2"
            >
              <label className={cn(
                'flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors',
                approvalAlerts === 'all' ? 'bg-primary/10' : 'hover:bg-accent/50'
              )}>
                <RadioGroupItem value="all" />
                <div>
                  <span className="text-sm font-medium">All approvals</span>
                  <p className="text-xs text-muted-foreground">Every action requiring your approval</p>
                </div>
              </label>
              <label className={cn(
                'flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors',
                approvalAlerts === 'critical' ? 'bg-primary/10' : 'hover:bg-accent/50'
              )}>
                <RadioGroupItem value="critical" />
                <div>
                  <span className="text-sm font-medium">Critical only</span>
                  <p className="text-xs text-muted-foreground">Outbound emails and LOIs only</p>
                </div>
              </label>
              <label className={cn(
                'flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors',
                approvalAlerts === 'none' ? 'bg-primary/10' : 'hover:bg-accent/50'
              )}>
                <RadioGroupItem value="none" />
                <div>
                  <span className="text-sm font-medium">None</span>
                  <p className="text-xs text-muted-foreground">Check manually in the dashboard</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Deal stage changes */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <IconChartBar className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="deal-stage-notif" className="font-medium">
                  Deal Stage Changes
                </Label>
                <p className="text-sm text-muted-foreground">
                  When deals move through the pipeline
                </p>
              </div>
            </div>
            <Switch
              id="deal-stage-notif"
              checked={dealStageChanges}
              onCheckedChange={(checked) => updatePref('dealStageChanges', checked)}
            />
          </div>

          {/* Agent activity */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <IconRobot className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="agent-activity-notif" className="font-medium">
                  Agent Activity
                </Label>
                <p className="text-sm text-muted-foreground">
                  When the agent completes analyses or drafts
                </p>
              </div>
            </div>
            <Switch
              id="agent-activity-notif"
              checked={agentActivity}
              onCheckedChange={(checked) => updatePref('agentActivity', checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Digest frequency */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <IconCalendar className="w-4 h-4 text-muted-foreground" />
          <Label className="font-medium">Activity Digest</Label>
        </div>

        <RadioGroup
          value={notifications.digest}
          onValueChange={(value) =>
            updatePref('digest', value as 'daily' | 'weekly' | 'none')
          }
          className="space-y-2"
        >
          <label
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
              notifications.digest === 'daily' ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
            )}
          >
            <RadioGroupItem value="daily" />
            <div>
              <span className="font-medium">Daily</span>
              <p className="text-xs text-muted-foreground">
                Summary every morning at 8am
              </p>
            </div>
          </label>

          <label
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
              notifications.digest === 'weekly' ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
            )}
          >
            <RadioGroupItem value="weekly" />
            <div>
              <span className="font-medium">Weekly</span>
              <p className="text-xs text-muted-foreground">
                Summary every Monday morning
              </p>
            </div>
          </label>

          <label
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
              notifications.digest === 'none' ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
            )}
          >
            <RadioGroupItem value="none" />
            <div>
              <span className="font-medium">None</span>
              <p className="text-xs text-muted-foreground">
                No digest emails
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      <Separator />

      {/* Quiet hours */}
      <div>
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <IconMoon className="w-5 h-5 text-muted-foreground" />
            <div>
              <Label htmlFor="quiet-hours" className="font-medium">
                Quiet Hours
              </Label>
              <p className="text-sm text-muted-foreground">
                Pause notifications from 10pm to 8am
              </p>
            </div>
          </div>
          <Switch
            id="quiet-hours"
            checked={quietHours.enabled}
            onCheckedChange={(checked) =>
              updatePref('quietHours', { ...quietHours, enabled: checked })
            }
          />
        </div>
      </div>
    </div>
  );
}

export default PreferencesStep;

import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const Settings = () => {
  const [threshold, setThreshold] = useState(0.45);
  const [lockoutMinutes, setLockoutMinutes] = useState(10);
  const [showKioskTips, setShowKioskTips] = useState(true);
  const [localMode, setLocalMode] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const savedThreshold = localStorage.getItem('recognitionThreshold');
    const savedLockout = localStorage.getItem('lockoutMinutes');
    const savedTips = localStorage.getItem('showKioskTips');
    const savedLocalMode = localStorage.getItem('localMode');

    if (savedThreshold) setThreshold(parseFloat(savedThreshold));
    if (savedLockout) setLockoutMinutes(parseInt(savedLockout));
    if (savedTips) setShowKioskTips(savedTips === 'true');
    if (savedLocalMode) setLocalMode(savedLocalMode === 'true');
  }, []);

  const handleThresholdChange = (value: number[]) => {
    const newThreshold = value[0];
    setThreshold(newThreshold);
    localStorage.setItem('recognitionThreshold', newThreshold.toString());
    toast.success(`Threshold updated to ${newThreshold.toFixed(2)}`);
  };

  const handleLockoutChange = (value: number[]) => {
    const newLockout = value[0];
    setLockoutMinutes(newLockout);
    localStorage.setItem('lockoutMinutes', newLockout.toString());
    toast.success(`Lockout period updated to ${newLockout} minutes`);
  };

  const handleTipsToggle = (checked: boolean) => {
    setShowKioskTips(checked);
    localStorage.setItem('showKioskTips', checked.toString());
    toast.success(`Kiosk tips ${checked ? 'enabled' : 'disabled'}`);
  };

  const handleLocalModeToggle = (checked: boolean) => {
    setLocalMode(checked);
    localStorage.setItem('localMode', checked.toString());
    toast.success(`Local mode ${checked ? 'enabled' : 'disabled'}`);
    if (checked) {
      toast.info('Local mode requires IndexedDB. Refresh the page to apply.');
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure face recognition and kiosk behavior</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recognition Threshold</CardTitle>
            <CardDescription>
              Lower values are stricter (fewer false matches), higher values are more lenient.
              Default: 0.45
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Threshold</Label>
                <span className="text-sm font-medium">{threshold.toFixed(2)}</span>
              </div>
              <Slider
                min={0.35}
                max={0.55}
                step={0.01}
                value={[threshold]}
                onValueChange={handleThresholdChange}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Stricter (0.35)</span>
                <span>Lenient (0.55)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Duplicate Lockout</CardTitle>
            <CardDescription>
              Prevent the same student from being marked multiple times within this period.
              Default: 10 minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Lockout Period</Label>
                <span className="text-sm font-medium">{lockoutMinutes} minutes</span>
              </div>
              <Slider
                min={5}
                max={30}
                step={1}
                value={[lockoutMinutes]}
                onValueChange={handleLockoutChange}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 min</span>
                <span>30 min</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kiosk Display</CardTitle>
            <CardDescription>
              Configure what appears in the kiosk mode interface
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="tips-toggle">Show Kiosk Tips</Label>
                <p className="text-sm text-muted-foreground">
                  Display helpful hints like "Move closer" or "Avoid backlight"
                </p>
              </div>
              <Switch
                id="tips-toggle"
                checked={showKioskTips}
                onCheckedChange={handleTipsToggle}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local Mode (Offline)</CardTitle>
            <CardDescription>
              Run entirely in-browser without backend. Uses IndexedDB for storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="local-toggle">Enable Local Mode</Label>
                <p className="text-sm text-muted-foreground">
                  All data stored locally. Export/Import available in future updates.
                </p>
              </div>
              <Switch
                id="local-toggle"
                checked={localMode}
                onCheckedChange={handleLocalModeToggle}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">About Face Recognition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>Threshold tuning:</strong> Start with 0.45. If you get false matches, decrease to 0.40-0.43. 
              If genuine students aren't recognized, increase to 0.47-0.50.
            </p>
            <p>
              <strong>Best practices:</strong> Ensure good lighting, have students face the camera directly, 
              and maintain consistent camera positioning for optimal results.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Settings;

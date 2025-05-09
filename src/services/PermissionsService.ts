import { Platform, NativeModules } from 'react-native';
import {
  RESULTS,
  check,
  request,
  openSettings,
  checkMultiple,
  requestMultiple,
  Permission,
} from 'react-native-permissions';

class PermissionsService {
  private static instance: PermissionsService;
  private permissionRequestTimestamps: Record<string, number> = {};
  private readonly MIN_REQUEST_INTERVAL = 3000; // 3 seconds between requests

  private constructor() {}

  public static getInstance(): PermissionsService {
    if (!PermissionsService.instance) {
      PermissionsService.instance = new PermissionsService();
    }
    return PermissionsService.instance;
  }

  public getNotificationPermission(): Permission {
    // Android-only implementation
    if (Platform.OS !== 'android') {
      throw new Error('This permission service is only for Android');
    }
    
    // For Android 13 (API 33) and above, we need POST_NOTIFICATIONS permission
    // For older versions, we use ACCESS_NOTIFICATION_POLICY
    return Number(Platform.Version) >= 33
      ? ('android.permission.POST_NOTIFICATIONS' as Permission)
      : ('android.permission.ACCESS_NOTIFICATION_POLICY' as Permission);
  }

  private canRequestPermission(permission: Permission): boolean {
    const now = Date.now();
    const lastRequest = this.permissionRequestTimestamps[permission] || 0;
    
    // Prevent request spam
    if (now - lastRequest < this.MIN_REQUEST_INTERVAL) {
      console.log(`Throttling permission request for ${permission}`);
      return false;
    }
    
    return true;
  }

  private updateRequestTimestamp(permission: Permission): void {
    this.permissionRequestTimestamps[permission] = Date.now();
  }

  public async checkNotificationPermission(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        console.log('Notifications only supported on Android for this app');
        return false;
      }
      
      const permission = this.getNotificationPermission();
      const result = await check(permission);
      
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return false;
    }
  }

  public async requestNotificationPermission(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        console.log('Notifications only supported on Android for this app');
        return false;
      }
      
      const permission = this.getNotificationPermission();
      
      // Prevent rapid permission requests
      if (!this.canRequestPermission(permission)) {
        return false;
      }
      
      // Update request timestamp
      this.updateRequestTimestamp(permission);
      
      const result = await request(permission);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  public async openAppSettings(): Promise<void> {
    try {
      await openSettings();
    } catch (error) {
      console.error('Error opening app settings:', error);
      // Provide fallback for older devices
      if (Platform.OS === 'android') {
        try {
          // Try to use Intent to open app details settings
          NativeModules.IntentLauncher?.startActivity({
            action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
            data: `package:${NativeModules.RNDeviceInfo?.getAppPackageName() || 'com.luvsab'}`,
          });
        } catch (backupError) {
          console.error('Backup method for opening settings failed:', backupError);
        }
      }
    }
  }

  public async isPermissionBlocked(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return false;
      }
      
      const permission = this.getNotificationPermission();
      const result = await check(permission);
      
      return result === RESULTS.BLOCKED || result === RESULTS.DENIED;
    } catch (error) {
      console.error('Error checking if permission is blocked:', error);
      return false;
    }
  }

  public async getPermissionDetails(): Promise<{
    granted: boolean;
    blocked: boolean;
    unavailable: boolean;
  }> {
    try {
      if (Platform.OS !== 'android') {
        return {
          granted: false,
          blocked: false,
          unavailable: true
        };
      }
      
      const permission = this.getNotificationPermission();
      const result = await check(permission);
      
      return {
        granted: result === RESULTS.GRANTED,
        blocked: result === RESULTS.BLOCKED || result === RESULTS.DENIED,
        unavailable: result === RESULTS.UNAVAILABLE
      };
    } catch (error) {
      console.error('Error getting permission details:', error);
      return {
        granted: false,
        blocked: false,
        unavailable: false
      };
    }
  }

  public async checkMultiplePermissions(permissions: Permission[]): Promise<{ [key in Permission]?: boolean }> {
    try {
      if (Platform.OS !== 'android') {
        return {};
      }
      
      const results = await checkMultiple(permissions);
      const formattedResults: { [key in Permission]?: boolean } = {};
      
      (Object.keys(results) as Permission[]).forEach(key => {
        formattedResults[key] = results[key] === RESULTS.GRANTED;
      });
      
      return formattedResults;
    } catch (error) {
      console.error('Error checking multiple permissions:', error);
      return {};
    }
  }
  
  public async requestMultiplePermissions(permissions: Permission[]): Promise<{ [key in Permission]?: boolean }> {
    try {
      if (Platform.OS !== 'android') {
        return {};
      }
      
      // Filter out permissions that were recently requested
      const filteredPermissions = permissions.filter(
        permission => this.canRequestPermission(permission)
      );
      
      if (filteredPermissions.length === 0) {
        return {};
      }
      
      // Update timestamps for all requested permissions
      filteredPermissions.forEach(permission => {
        this.updateRequestTimestamp(permission);
      });
      
      const results = await requestMultiple(filteredPermissions);
      const formattedResults: { [key in Permission]?: boolean } = {};
      
      (Object.keys(results) as Permission[]).forEach(key => {
        formattedResults[key] = results[key] === RESULTS.GRANTED;
      });
      
      return formattedResults;
    } catch (error) {
      console.error('Error requesting multiple permissions:', error);
      return {};
    }
  }
}

export default PermissionsService; 
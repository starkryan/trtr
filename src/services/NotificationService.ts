import notifee, {
  AndroidImportance,
  AndroidVisibility,
  EventType,
  EventDetail,
  AndroidColor,
  TimestampTrigger,
  TriggerType
} from '@notifee/react-native';
import messaging, { 
  FirebaseMessagingTypes,
  getMessaging,
  getToken,
  onMessage
} from '@react-native-firebase/messaging';
import PermissionsService from './PermissionsService';
import { InteractionManager } from 'react-native';

// Queue system for notification operations
type NotificationOperation = () => Promise<void>;

class NotificationService {
  private static instance: NotificationService;
  private handledNotificationIds: Set<string> = new Set();
  private permissionsService: PermissionsService;
  private isProcessingQueue: boolean = false;
  private operationQueue: NotificationOperation[] = [];
  private channelCreated: boolean = false;
  private permissionRequestInProgress: boolean = false;
  private permissionLastChecked: number = 0;
  private readonly PERMISSION_CHECK_INTERVAL = 60000; // 1 minute
  private messagingInstance: FirebaseMessagingTypes.Module;

  private constructor() {
    this.permissionsService = PermissionsService.getInstance();
    this.messagingInstance = messaging();
    // Initialize notification listeners
    this.initializeNotificationListeners();
    // Create default channel at startup
    this.createDefaultChannelAsync();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Add operation to queue and process if not already processing
  private async enqueueOperation(operation: NotificationOperation): Promise<void> {
    this.operationQueue.push(operation);
    if (!this.isProcessingQueue) {
      await this.processQueue();
    }
  }

  // Process queue sequentially
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.operationQueue.length > 0) {
        const operation = this.operationQueue.shift();
        if (operation) {
          await operation();
        }
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async initializeNotificationListeners() {
    // Set up foreground event listener
    notifee.onForegroundEvent(({ type, detail }) => {
      // Use InteractionManager to avoid UI freezing
      InteractionManager.runAfterInteractions(() => {
        this.handleNotificationEvent(type, detail);
      });
    });

    // Set up background event listener
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      await this.handleNotificationEvent(type, detail);
      return Promise.resolve();
    });

    // Set up FCM message handler - using modular API
    onMessage(this.messagingInstance, async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      // Enqueue this operation to prevent UI freezing
      this.enqueueOperation(async () => {
        if (remoteMessage.notification) {
          await this.displayNotification(
            remoteMessage.notification.title || 'New Message',
            remoteMessage.notification.body || '',
            remoteMessage.data
          );
        }
      });
    });
  }

  // Handle notification events
  private async handleNotificationEvent(type: EventType, detail: EventDetail) {
    const notificationId = detail.notification?.id;
    
    if (!notificationId || this.handledNotificationIds.has(notificationId)) {
      return;
    }

    switch (type) {
      case EventType.PRESS:
        console.log('User pressed notification', detail.notification);
        this.handledNotificationIds.add(notificationId);
        break;
      case EventType.DISMISSED:
        console.log('User dismissed notification', detail.notification);
        this.handledNotificationIds.add(notificationId);
        // Clean up old IDs periodically
        if (this.handledNotificationIds.size > 100) {
          this.handledNotificationIds.clear();
        }
        break;
    }
  }

  // Create notification channel for Android asynchonously
  private async createDefaultChannelAsync() {
    this.enqueueOperation(async () => {
      if (this.channelCreated) return;
      
      try {
        await this.createDefaultChannel();
      } catch (error) {
        console.error('Error creating default notification channel:', error);
      }
    });
  }

  // Create notification channel for Android
  public async createDefaultChannel() {
    if (this.channelCreated) return;
    
    try {
      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        vibration: true,
        lights: true,
        lightColor: AndroidColor.RED,
        sound: 'default',
        badge: true
      });
      
      this.channelCreated = true;
    } catch (error) {
      console.error('Error creating notification channel:', error);
      throw error;
    }
  }

  // Display a basic notification
  public async displayNotification(
    title: string, 
    body: string,
    data?: Record<string, any>
  ) {
    return new Promise<boolean>((resolve) => {
      // Enqueue to prevent UI freezing
      this.enqueueOperation(async () => {
        try {
          // Check permission before displaying notification
          const hasPermission = await this.checkPermission();
          if (!hasPermission) {
            console.log('No notification permission');
            resolve(false);
            return;
          }

          // Create channel if it doesn't exist
          if (!this.channelCreated) {
            await this.createDefaultChannel();
          }

          // Extract Android settings from data if present
          const androidConfig = data?.android || {};

          // Display notification
          const notificationId = await notifee.displayNotification({
            id: `notification-${Date.now()}`,
            title,
            body,
            data,
            android: {
              channelId: 'default',
              importance: AndroidImportance.HIGH,
              pressAction: {
                id: 'default',
                launchActivity: 'default',
              },
              autoCancel: true,
              smallIcon: 'ic_notification',
              color: '#EC4899',
              ...androidConfig // Merge any custom Android settings
            },
          });
          
          console.log('Notification displayed with ID:', notificationId);
          resolve(true);
        } catch (error) {
          console.error('Error displaying notification:', error);
          resolve(false);
        }
      });
    });
  }

  // Display a notification with custom data
  public async displayNotificationWithData(
    title: string,
    body: string,
    data: Record<string, any>
  ) {
    return this.displayNotification(title, body, data);
  }

  // Schedule a notification for future delivery
  public async scheduleNotification(
    title: string,
    body: string,
    timestamp: number,
    data?: Record<string, any>
  ): Promise<string | null> {
    return new Promise((resolve) => {
      this.enqueueOperation(async () => {
        try {
          // Check permission
          const hasPermission = await this.checkPermission();
          if (!hasPermission) {
            console.log('No notification permission for scheduling');
            resolve(null);
            return;
          }

          // Create channel if needed
          if (!this.channelCreated) {
            await this.createDefaultChannel();
          }

          // Create a time-based trigger
          const trigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp: timestamp,
          };

          // Create the notification
          const notificationId = await notifee.createTriggerNotification(
            {
              title,
              body,
              data,
              android: {
                channelId: 'default',
                importance: AndroidImportance.HIGH,
                pressAction: {
                  id: 'default',
                  launchActivity: 'default',
                },
              },
            },
            trigger,
          );

          console.log('Notification scheduled with ID:', notificationId);
          resolve(notificationId);
        } catch (error) {
          console.error('Error scheduling notification:', error);
          resolve(null);
        }
      });
    });
  }

  // Check notification permissions with throttling to prevent frequent checks
  public async checkPermission(): Promise<boolean> {
    const now = Date.now();
    
    // Use cached result if checked recently
    if (now - this.permissionLastChecked < this.PERMISSION_CHECK_INTERVAL) {
      const cachedResult = await this.permissionsService.checkNotificationPermission();
      return cachedResult;
    }
    
    try {
      const result = await this.permissionsService.checkNotificationPermission();
      this.permissionLastChecked = now;
      return result;
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return false;
    }
  }

  // Request notification permissions with safeguards against multiple requests
  public async requestPermission(): Promise<boolean> {
    // Prevent multiple simultaneous requests
    if (this.permissionRequestInProgress) {
      console.log('Permission request already in progress');
      return false;
    }

    this.permissionRequestInProgress = true;

    try {
      // First check if permission is already granted
      const hasPermission = await this.checkPermission();
      if (hasPermission) {
        this.permissionRequestInProgress = false;
        return true;
      }

      // Check if blocked - avoid showing request if already blocked
      const isBlocked = await this.isPermissionBlocked();
      if (isBlocked) {
        console.log('Notification permission is blocked - should open settings');
        this.permissionRequestInProgress = false;
        return false;
      }

      // Request permission if not granted and not blocked
      const granted = await this.permissionsService.requestNotificationPermission();
      if (granted) {
        // Get FCM token after permission is granted - using modular API
        try {
          const fcmToken = await getToken(this.messagingInstance);
          console.log('FCM Token:', fcmToken);
        } catch (error) {
          console.error('Error getting FCM token:', error);
        }
      }

      // Update last checked time
      this.permissionLastChecked = Date.now();
      
      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    } finally {
      this.permissionRequestInProgress = false;
    }
  }

  // Get detailed permission status
  public async getPermissionStatus(): Promise<{
    granted: boolean;
    blocked: boolean;
  }> {
    try {
      const granted = await this.checkPermission();
      const blocked = await this.isPermissionBlocked();
      return { granted, blocked };
    } catch (error) {
      console.error('Error getting permission status:', error);
      // Default to safer values
      return { granted: false, blocked: false };
    }
  }

  // Check if permission is blocked
  public async isPermissionBlocked(): Promise<boolean> {
    try {
      return await this.permissionsService.isPermissionBlocked();
    } catch (error) {
      console.error('Error checking if permission is blocked:', error);
      return false;
    }
  }

  // Open app settings
  public async openSettings(): Promise<void> {
    return this.permissionsService.openAppSettings();
  }

  // Cancel all notifications
  public async cancelAllNotifications() {
    this.enqueueOperation(async () => {
      try {
        await notifee.cancelAllNotifications();
        this.handledNotificationIds.clear();
      } catch (error) {
        console.error('Error cancelling all notifications:', error);
      }
    });
  }

  // Cancel a specific notification
  public async cancelNotification(notificationId: string) {
    this.enqueueOperation(async () => {
      try {
        await notifee.cancelNotification(notificationId);
        this.handledNotificationIds.delete(notificationId);
      } catch (error) {
        console.error(`Error cancelling notification ${notificationId}:`, error);
      }
    });
  }
}

export default NotificationService; 
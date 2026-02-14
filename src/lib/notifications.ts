/**
 * Notifications & Reminders
 * Send ride reminders and updates to users
 */

export interface Notification {
  id: string;
  user_id: string;
  type: 'reminder' | 'payment' | 'split' | 'badge' | 'referral';
  title: string;
  message: string;
  action_url?: string;
  read: boolean;
  created_at: string;
  scheduled_for?: string;
}

/**
 * Schedule ride reminder
 * 30 min before and 10 min before ride
 */
export const scheduleRideReminder = async (
  rideId: string,
  userId: string,
  rideTime: string,
  pickupLocation: string
): Promise<boolean> => {
  try {
    const rideDate = new Date(rideTime);
    const now = new Date();

    // Calculate when to send notifications
    const thirtyMinBefore = new Date(rideDate.getTime() - 30 * 60 * 1000);
    const tenMinBefore = new Date(rideDate.getTime() - 10 * 60 * 1000);

    // Schedule 30-min reminder
    if (thirtyMinBefore > now) {
      scheduleNotification({
        user_id: userId,
        type: 'reminder',
        title: 'Ride in 30 minutes',
        message: `Your ride from ${pickupLocation} starts in 30 minutes. Get ready!`,
        action_url: `/split/${rideId}`,
        scheduled_for: thirtyMinBefore.toISOString(),
      });
    }

    // Schedule 10-min reminder
    if (tenMinBefore > now) {
      scheduleNotification({
        user_id: userId,
        type: 'reminder',
        title: 'Ride in 10 minutes',
        message: `Your ride is starting in 10 minutes. Head to the pickup location!`,
        action_url: `/split/${rideId}`,
        scheduled_for: tenMinBefore.toISOString(),
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to schedule reminder:', error);
    return false;
  }
};

/**
 * Schedule generic notification
 */
const scheduleNotification = (notification: Partial<Notification>) => {
  console.log('📬 Scheduled notification:', notification);
  // In production: Save to notifications table in Supabase
};

/**
 * Send payment reminder
 */
export const sendPaymentReminder = (userId: string, amount: number, personName: string): boolean => {
  try {
    scheduleNotification({
      user_id: userId,
      type: 'payment',
      title: 'Payment reminder',
      message: `You owe ₹${amount} to ${personName}. Settle it now!`,
      action_url: '/settlement',
    });
    return true;
  } catch (error) {
    console.error('Failed to send payment reminder:', error);
    return false;
  }
};

/**
 * Send split created notification
 */
export const sendSplitNotification = (recipientId: string, senderName: string, amount: number): boolean => {
  try {
    scheduleNotification({
      user_id: recipientId,
      type: 'split',
      title: `${senderName} invited you to a split`,
      message: `Join a ride split and save ₹${amount}!`,
    });
    return true;
  } catch (error) {
    console.error('Failed to send split notification:', error);
    return false;
  }
};

/**
 * Send badge notification
 */
export const sendBadgeNotification = (userId: string, badgeName: string): boolean => {
  try {
    scheduleNotification({
      user_id: userId,
      type: 'badge',
      title: `You earned: ${badgeName}`,
      message: `Congratulations! You unlocked the ${badgeName} badge!`,
      action_url: '/profile',
    });
    return true;
  } catch (error) {
    console.error('Failed to send badge notification:', error);
    return false;
  }
};

/**
 * Send referral notification
 */
export const sendReferralNotification = (userId: string, amount: number): boolean => {
  try {
    scheduleNotification({
      user_id: userId,
      type: 'referral',
      title: 'Referral earned!',
      message: `You earned ₹${amount} from a successful referral!`,
      action_url: '/profile',
    });
    return true;
  } catch (error) {
    console.error('Failed to send referral notification:', error);
    return false;
  }
};

/**
 * Get user notifications
 */
export const getUserNotifications = async (userId: string, limit: number = 20) => {
  try {
    console.log(`📬 Getting notifications for user ${userId}`);
    // In production: Fetch from notifications table
    return [];
  } catch (error) {
    console.error('Failed to get notifications:', error);
    return [];
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    console.log(`✅ Marked notification ${notificationId} as read`);
    // In production: Update in database
    return true;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return false;
  }
};

/**
 * Send email notification
 */
export const sendEmailNotification = (
  email: string,
  subject: string,
  message: string
): boolean => {
  try {
    console.log(`📧 Sending email to ${email}: ${subject}`);
    // In production: Use email service (SendGrid, etc.)
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
};

/**
 * Send push notification
 */
export const sendPushNotification = (userId: string, title: string, message: string): boolean => {
  try {
    console.log(`📲 Push notification for ${userId}: ${title}`);
    // In production: Use FCM or similar
    return true;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
};

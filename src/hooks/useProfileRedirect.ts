import { caregiverService } from '@/src/services/caregiver.service';
import { CaregiverProfile } from '@/src/types/caregiver.types';

export async function checkAndRedirect(navigation: any) {
  try {
    const response = await caregiverService.getProfile();
    if (response.success && response.data) {
      const profile: CaregiverProfile = response.data;
      // You can adjust this logic as needed
      if (profile.profile_status === 'completed' || profile.profile_completion_step >= 3) {
        navigation.navigate('BottomNavigation');
      } else {
        // Navigate to the correct setup step based on profile_completion_step
        if (profile.profile_completion_step === 1) {
          navigation.navigate('CaregiverSetupStep2');
        } else if (profile.profile_completion_step === 2) {
          navigation.navigate('IdentityVerification');
        } else {
          navigation.navigate('CaregiverSetupStep1');
        }
      }
    } else {
      // If profile fetch fails, fallback to setup step 1
      navigation.navigate('CaregiverSetupStep1');
    }
  } catch (error) {
    navigation.navigate('CaregiverSetupStep1');
  }
} 
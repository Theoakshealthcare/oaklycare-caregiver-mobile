import React, { useState } from 'react';
import { Alert, View, ScrollView, TouchableOpacity, Image, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from '@/src/components/ui/text';
import Button from '@/src/components/ui/button';
import { theme } from '@/src/constants/theme';
import { globalStyles } from '@/src/constants/styles';
import { authService } from '@/src/services/auth.service';

const mockAppointments = [
  {
    id: '1',
    name: 'Julius A',
    role: 'Physical Therapist',
    time: 'Today, 2:00 PM',
    duration: '1 hour',
    avatar: require('@/assets/images/pngs/avatar1.png'),
  },
];

const mockJobRequests = [
  {
    id: '2',
    name: 'Mrs Thompson',
    role: 'Wound Dressing',
    time: 'Today, 2:00 PM',
    duration: '1 hour',
    avatar: require('@/assets/images/pngs/avatar2.png'),
  },
];

const Home: React.FC = () => {
  const [available, setAvailable] = useState(true);
  const [profileCompletion] = useState(80); // percent

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.primary }}>
      {/* Header */}
      <View style={{ paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text variant="h2" weight="bold" color={theme.colors.white}>Hello Julius, 👋</Text>
          <Text variant="body" color={theme.colors.white} style={{ marginTop: 4 }}>What do you like to do today ?</Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            Alert.alert('Sign out', 'Do you want to sign out of Oakly?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void authService.logout() },
            ])
          }
        >
          <Image source={require('@/assets/images/pngs/avatar1.png')} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: theme.colors.white }} />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Weekly Availability & Calendar */}
        <View style={{ padding: 20, paddingBottom: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text variant="body" weight="bold">Weekly Availability</Text>
            <Switch value={available} onValueChange={setAvailable} thumbColor={available ? theme.colors.primary : theme.colors.border} trackColor={{ true: theme.colors.primary, false: theme.colors.border }} />
          </View>
          <Text variant="body" color={theme.colors.textLight} style={{ marginBottom: 8 }}>March 2025</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, idx) => (
              <View key={day} style={{ alignItems: 'center' }}>
                <Text variant="small" color={theme.colors.textLight}>{day}</Text>
                <View style={{
                  marginTop: 4,
                  backgroundColor: idx === 2 ? theme.colors.primary : theme.colors.white,
                  borderRadius: 12,
                  width: 32,
                  height: 32,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}>
                  <Text variant="body" color={idx === 2 ? theme.colors.white : theme.colors.text}>{29 + idx}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        {/* CarePlan Section */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View style={{ backgroundColor: theme.colors.primaryLight, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="bold">CarePlan</Text>
              <Text variant="small" color={theme.colors.textLight}>Lets help you put health care for your loved one</Text>
            </View>
            <Button title="Create Care Plan" style={{ marginLeft: 12 }} />
          </View>
        </View>
        {/* Profile Completion (optional) */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text variant="body" weight="bold" style={{ marginBottom: 4 }}>Profile Completion</Text>
          <View style={{ backgroundColor: theme.colors.primaryLight, borderRadius: 12, height: 12, overflow: 'hidden', marginBottom: 4 }}>
            <View style={{ width: `${profileCompletion}%`, backgroundColor: theme.colors.primary, height: '100%' }} />
          </View>
          <Text variant="small" color={theme.colors.primary}>In Progress</Text>
        </View>
        {/* Upcoming Appointments */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text variant="body" weight="bold" style={{ marginBottom: 8 }}>Upcoming Appointments</Text>
          {mockAppointments.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 24, backgroundColor: theme.colors.white, borderRadius: 16 }}>
              <Feather name="calendar" size={48} color={theme.colors.primary} style={{ marginBottom: 8 }} />
              <Text variant="body" weight="bold" style={{ marginBottom: 4 }}>You do not have any appointments</Text>
              <Text variant="small" color={theme.colors.textLight} style={{ textAlign: 'center' }}>Click on start booking to book appointments for your loved ones</Text>
            </View>
          ) : (
            mockAppointments.map((appt) => (
              <View key={appt.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.white, borderRadius: 16, padding: 12, marginBottom: 8 }}>
                <Image source={appt.avatar} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="bold">{appt.name}</Text>
                  <Text variant="small" color={theme.colors.textLight}>{appt.role}</Text>
                  <Text variant="small" color={theme.colors.textLight}>{appt.time} • {appt.duration}</Text>
                </View>
                <Button title="Check In" style={{ marginRight: 8 }} />
                <Button title="Check Out" variant="neutral" textStyle={{ color: theme.colors.primary }} />
              </View>
            ))
          )}
        </View>
        {/* New Job Request */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text variant="body" weight="bold" style={{ marginBottom: 8 }}>New Job Request</Text>
          {mockJobRequests.map((job) => (
            <View key={job.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.white, borderRadius: 16, padding: 12, marginBottom: 8 }}>
              <Image source={job.avatar} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="bold">{job.name}</Text>
                <Text variant="small" color={theme.colors.textLight}>{job.role}</Text>
                <Text variant="small" color={theme.colors.textLight}>{job.time} • {job.duration}</Text>
              </View>
              <Button title="Accept" style={{ marginRight: 8 }} />
              <Button title="Decline" variant="neutral" textStyle={{ color: theme.colors.primary }} />
            </View>
          ))}
        </View>
        {/* Earning Summary */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text variant="body" weight="bold" style={{ marginBottom: 8 }}>Earning Summary</Text>
          <View style={{ flexDirection: 'row', backgroundColor: theme.colors.white, borderRadius: 16, padding: 16, justifyContent: 'space-between' }}>
            <View>
              <Text variant="small" color={theme.colors.textLight}>Weekly Earning</Text>
              <Text variant="body" weight="bold" color={theme.colors.primary}>₦500,000</Text>
            </View>
            <View>
              <Text variant="small" color={theme.colors.textLight}>Pending Payment</Text>
              <Text variant="body" weight="bold" color={theme.colors.primary}>₦500,000</Text>
            </View>
          </View>
        </View>
        {/* Notifications */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text variant="body" weight="bold" style={{ marginBottom: 8 }}>Notification</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.white, borderRadius: 16, padding: 12, marginBottom: 8 }}>
            <Feather name="message-square" size={24} color={theme.colors.primary} style={{ marginRight: 12 }} />
            <Text variant="body" style={{ flex: 1 }}>Mrs Thompson sent you a Message</Text>
            <Text variant="small" color={theme.colors.textLight}>10 Min Ago</Text>
          </View>
        </View>
        {/* Client Care Access */}
        <View style={{ paddingHorizontal: 20, marginBottom: 32 }}>
          <Text variant="body" weight="bold" style={{ marginBottom: 8 }}>Client Care Access</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button title="Clients Profiles" style={{ flex: 1 }} />
            <Button title="vitals & Fall Guard" style={{ flex: 1 }} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default Home; 
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { AlertsIcon, HomeIcon, MapIcon } from '../../components/TabIcons';
import { colors, fonts } from '../../constants/theme';

function TabIconWrap({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.tabActivePill : 'transparent',
      }}
    >
      {children}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: '#C9B99A',
        tabBarLabelStyle: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.screenBg,
          borderTopWidth: 0,
          height: 88,
          paddingTop: 10,
        },
        tabBarItemStyle: { gap: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <TabIconWrap focused={focused}>
              <HomeIcon color={color} />
            </TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ focused, color }) => (
            <TabIconWrap focused={focused}>
              <MapIcon color={color} />
            </TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused, color }) => (
            <TabIconWrap focused={focused}>
              <AlertsIcon color={color} />
            </TabIconWrap>
          ),
        }}
      />
    </Tabs>
  );
}

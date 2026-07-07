import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { PillButton } from '../../components/PillButton';
import { PulsingPin } from '../../components/PulsingPin';
import { StripedBackground } from '../../components/StripedBackground';
import { colors, fonts, spacing } from '../../constants/theme';
import { kid, liveLocation } from '../../data/mock';

export default function MapScreen() {
  const [askingHome, setAskingHome] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const askHome = () => {
    if (askingHome) return;
    setAskingHome(true);
    timeout.current = setTimeout(() => setAskingHome(false), 2200);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.label}>LIVE LOCATION</Text>
        <Text style={styles.title}>Where's {kid.name}?</Text>
      </View>

      <View style={styles.mapArea}>
        <StripedBackground colorA="#F3EEE0" colorB="#E9E2CF" />
        <Text style={styles.mapPlaceholder}>map view — drop live map here</Text>
        <View style={styles.dashedCircle} />
        <View style={styles.pinWrap}>
          <PulsingPin />
        </View>
      </View>

      <View style={styles.bottom}>
        <Card style={{ marginBottom: spacing.gap }}>
          <Text style={styles.placeName}>{liveLocation.placeName}</Text>
          <Text style={styles.placeSub}>
            {liveLocation.distanceFromHome} · updated {liveLocation.updatedAgo}
          </Text>
        </Card>
        <PillButton
          label={askingHome ? 'On our way home!' : 'Ask DuckLAN to head home'}
          tone={askingHome ? 'success' : 'accent'}
          onPress={askHome}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  header: { paddingHorizontal: spacing.screenPadding, paddingBottom: 14 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.amber, letterSpacing: 0.4 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink },
  mapArea: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 24,
    backgroundColor: '#F3EEE0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholder: {
    position: 'absolute',
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.labelMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dashedCircle: {
    position: 'absolute',
    top: '34%',
    left: '32%',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#C9A227',
    opacity: 0.5,
  },
  pinWrap: {
    position: 'absolute',
    top: '44%',
    left: '48%',
  },
  bottom: { padding: 20, paddingHorizontal: spacing.screenPadding },
  placeName: { fontFamily: fonts.headingSemiBold, fontSize: 15, color: colors.ink },
  placeSub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginTop: 2 },
});

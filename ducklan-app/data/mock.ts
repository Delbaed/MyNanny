import type { Alert, Kid, LiveLocation } from '../types';

export const kid: Kid = {
  id: 'milo',
  name: 'Milo',
  greeting: 'Good afternoon',
};

export const liveLocation: LiveLocation = {
  placeName: 'Maple Street Park',
  distanceFromHome: '0.4 mi from home',
  updatedAgo: '30s ago',
};

export const alerts: Alert[] = [
  {
    id: '1',
    title: 'Milo took a little stumble',
    time: '12:04 PM',
    detail: "DuckLAN steadied him right away and stayed close — he was back on his feet in seconds.",
    hue: 40,
  },
  {
    id: '2',
    title: 'A friendly stranger said hi',
    time: '11:38 AM',
    detail: "Someone stopped to chat near the swings. DuckLAN stayed within arm's reach the whole time.",
    hue: 255,
  },
  {
    id: '3',
    title: 'Milo wandered a little far',
    time: '11:15 AM',
    detail: 'He got curious about the fountain. DuckLAN gently guided him back to the play area.',
    hue: 40,
  },
  {
    id: '4',
    title: 'Milo got a bit upset',
    time: '10:52 AM',
    detail: 'A scraped knee brought some tears. DuckLAN played his favorite calming sound and he settled quickly.',
    hue: 340,
  },
  {
    id: '5',
    title: 'All clear for two hours',
    time: '10:00 AM',
    detail: 'A calm, happy stretch of play — nothing to report.',
    hue: 145,
  },
];

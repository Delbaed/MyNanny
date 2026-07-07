export type DuckMode = 'watching' | 'resting' | 'charging';

export type Kid = {
  id: string;
  name: string;
  greeting: string;
};

export type Alert = {
  id: string;
  title: string;
  time: string;
  detail: string;
  hue: 40 | 255 | 340 | 145;
};

export type LiveLocation = {
  placeName: string;
  distanceFromHome: string;
  updatedAgo: string;
};

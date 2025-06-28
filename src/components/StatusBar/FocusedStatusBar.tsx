import {StatusBar} from 'react-native';
import React from 'react';
import {theme} from '../../constants/theme';

type Props = {
  translucent?: boolean;
  backgroundColor?: string;
  animated?: boolean;
  barStyle?: string;
  // Add more props if needed
};

const FocusedStatusBar: React.FC<Props> = (props: object) => {
  return (
    <StatusBar
      barStyle={'light-content'}
      translucent={false}
      backgroundColor={theme.colors.primary}
      animated={true}
      {...props}
    />
  );
};

export default FocusedStatusBar;

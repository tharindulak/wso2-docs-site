// PROTOTYPE: variant B never renders MUI; this stub keeps Oxygen UI out of its bundle so size is comparable.
const Noop = () => null;
export const OxygenUIThemeProvider = ({ children }) => children;
export const ThemeProvider = ({ children }) => children;
export const useColorScheme = () => ({ setMode: () => {} });
export const WSO2Theme = {};
export const Paper = Noop, Stack = Noop, Chip = Noop, Typography = Noop, AppBar = Noop, Toolbar = Noop,
  Box = Noop, Button = Noop, Menu = Noop, MenuItem = Noop, ListItemText = Noop;

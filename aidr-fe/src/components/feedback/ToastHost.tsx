import { Toaster } from 'sonner';
import { selectThemeMode } from '../../store/themeSlice';
import { useAppSelector } from '../../store/hooks';

export function ToastHost() {
  const theme = useAppSelector(selectThemeMode);

  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      theme={theme}
      toastOptions={{
        className: 'aidr-toast',
      }}
    />
  );
}

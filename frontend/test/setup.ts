import '@testing-library/jest-native/extend-expect'

// expo-router é mockado por inteiro: `jest.requireActual` puxa o runtime do
// router, que espera um contexto de navegação montado e quebra em teste de
// componente isolado.
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
  }),
  useSegments: () => [],
  usePathname: () => '/',
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => ({}),
  Redirect: () => null,
  Slot: () => null,
  Link: 'Link',
}))

// Animações em teste geram atualizações de estado fora de `act` e deixam
// timers pendentes depois que o caso termina. Declarar "movimento reduzido"
// como padrão desliga-as de forma determinística; o caso que verifica a
// animação sobrescreve o retorno deste hook.
jest.mock('../src/theme/useReducedMotion', () => ({
  useReducedMotion: jest.fn(() => true),
}))

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// Insets reais dependem do aparelho e do recorte da tela. Em teste eles
// precisam ser determinísticos — e sem provider montado, `useSafeAreaInsets`
// lança. O mock publicado pelo pacote não expõe os hooks nomeados nesta versão,
// então o mock é escrito aqui.
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 }
  const frame = { x: 0, y: 0, width: 390, height: 844 }
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaInsetsContext: {
      Consumer: ({ children }: { children: (value: typeof insets) => React.ReactNode }) =>
        children(insets),
    },
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  }
})

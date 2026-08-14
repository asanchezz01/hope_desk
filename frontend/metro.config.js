// Metro config do Hope Desk.
//
// O padrão do Expo já resolve as extensões de plataforma (.web.ts, .ios.ts,
// .android.ts) e os campos "browser"/"react-native" dos pacotes. Um
// `resolveRequest` customizado reescrevendo `expo-secure-store` para
// `expo-secure-store/web` quebra o bundle Web, porque esse subcaminho não
// existe no pacote. A diferença de plataforma no armazenamento de sessão é
// tratada em src/storage/session-storage.ts, que escolhe SecureStore ou
// AsyncStorage em tempo de execução via Platform.OS.
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

module.exports = config

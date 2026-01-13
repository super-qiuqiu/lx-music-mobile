// import Event from './event/event'

// 局域网同步（原有功能）
export {
  connectServer,
  disconnectServer,
  getStatus,
} from './client'

// Firebase同步（新增功能）
export {
  connectAndCreateRoom as connectFirebaseRoom,
  connectAndJoinRoom as joinFirebaseRoom,
  disconnectFirebase,
  getRoomInfo as getFirebaseRoomInfo,
  updateRemoteState as updateFirebaseState,
  syncCurrentState as syncFirebaseState,
  isController as isFirebaseController,
  setController as setFirebaseController,
  onConnectionStatusChange as onFirebaseStatusChange,
  syncPlaylist as syncFirebasePlaylist,
} from './firebase'

// 导出Firebase类型
export type { ConnectionStatus, RoomInfo } from './firebase'

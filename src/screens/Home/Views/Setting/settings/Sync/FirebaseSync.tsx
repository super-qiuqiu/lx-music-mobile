import { memo, useCallback, useState, useEffect, useRef } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Input from '@/components/common/Input'
import Button from '../../components/Button'
import { 
  connectFirebaseRoom, 
  joinFirebaseRoom, 
  disconnectFirebase,
  getFirebaseRoomInfo,
} from '@/plugins/sync'
import { createStyle, toast } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const [isConnected, setIsConnected] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [inputRoomCode, setInputRoomCode] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const confirmAlertRef = useRef<ConfirmAlertType>(null)
  const isUnmountedRef = useRef(false)

  useEffect(() => {
    isUnmountedRef.current = false

    // 检查初始连接状态
    const roomInfo = getFirebaseRoomInfo()
    if (roomInfo.isInRoom) {
      setIsConnected(true)
      setRoomCode(roomInfo.roomCode || '')
      setConnectionStatus(roomInfo.connectionStatus)
    }

    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  // 创建房间
  const handleCreateRoom = useCallback(async () => {
    try {
      setConnectionStatus('connecting')
      const result = await connectFirebaseRoom()
      
      if (isUnmountedRef.current) return
      
      setIsConnected(true)
      setRoomCode(result.roomCode)
      setConnectionStatus('connected')
      toast(t('setting_sync_firebase_room_created', { code: result.roomCode }))
    } catch (error: any) {
      console.error('[Firebase UI] 创建房间失败:', error)
      setConnectionStatus('error')
      toast(t('setting_sync_firebase_create_failed') + ': ' + error.message)
    }
  }, [t])

  // 加入房间
  const handleJoinRoom = useCallback(async () => {
    const code = inputRoomCode.trim().toUpperCase()
    if (code.length !== 6) {
      toast(t('setting_sync_firebase_invalid_code'))
      return
    }

    try {
      setConnectionStatus('connecting')
      await joinFirebaseRoom(code)
      
      if (isUnmountedRef.current) return
      
      setIsConnected(true)
      setRoomCode(code)
      setInputRoomCode('')
      setConnectionStatus('connected')
      confirmAlertRef.current?.setVisible(false)
      toast(t('setting_sync_firebase_room_joined'))
    } catch (error: any) {
      console.error('[Firebase UI] 加入房间失败:', error)
      setConnectionStatus('error')
      toast(t('setting_sync_firebase_join_failed') + ': ' + error.message)
    }
  }, [inputRoomCode, t])

  // 断开连接
  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectFirebase()
      
      if (isUnmountedRef.current) return
      
      setIsConnected(false)
      setRoomCode('')
      setConnectionStatus('disconnected')
      toast(t('setting_sync_firebase_disconnected'))
    } catch (error: any) {
      console.error('[Firebase UI] 断开连接失败:', error)
      toast(t('setting_sync_firebase_disconnect_failed'))
    }
  }, [t])

  // 显示加入房间对话框
  const handleShowJoinDialog = useCallback(() => {
    confirmAlertRef.current?.setVisible(true)
  }, [])

  // 取消加入房间
  const handleCancelJoin = useCallback(() => {
    setInputRoomCode('')
    confirmAlertRef.current?.setVisible(false)
  }, [])

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title} size={16}>{t('setting_sync_firebase_title')}</Text>
        <Text style={styles.description} size={13}>{t('setting_sync_firebase_description')}</Text>
        
        {isConnected ? (
          <>
            <View style={styles.roomInfo}>
              <Text style={styles.label} size={14}>{t('setting_sync_firebase_room_code')}:</Text>
              <Text style={styles.roomCode} size={18}>{roomCode}</Text>
              <Text style={styles.status} size={13}>
                {connectionStatus === 'connected' 
                  ? t('setting_sync_firebase_status_connected')
                  : connectionStatus === 'connecting'
                  ? t('setting_sync_firebase_status_connecting')
                  : t('setting_sync_firebase_status_error')}
              </Text>
            </View>
            <View style={styles.buttonContainer}>
              <Button onPress={handleDisconnect} style={styles.button}>
                {t('setting_sync_firebase_disconnect')}
              </Button>
            </View>
          </>
        ) : (
          <View style={styles.buttonContainer}>
            <Button onPress={handleCreateRoom} style={styles.button}>
              {t('setting_sync_firebase_create_room')}
            </Button>
            <Button onPress={handleShowJoinDialog} style={styles.button}>
              {t('setting_sync_firebase_join_room')}
            </Button>
          </View>
        )}
      </View>

      <ConfirmAlert
        onCancel={handleCancelJoin}
        onConfirm={handleJoinRoom}
        ref={confirmAlertRef}
      >
        <View style={styles.joinDialogContent}>
          <Text style={styles.joinDialogLabel}>{t('setting_sync_firebase_enter_code')}</Text>
          <Input
            placeholder={t('setting_sync_firebase_code_placeholder')}
            value={inputRoomCode}
            onChangeText={setInputRoomCode}
            style={{ ...styles.codeInput, backgroundColor: theme['c-primary-background'] }}
            maxLength={6}
            autoCapitalize="characters"
          />
        </View>
      </ConfirmAlert>
    </>
  )
})

const styles = createStyle({
  container: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  description: {
    opacity: 0.7,
    marginBottom: 10,
  },
  roomInfo: {
    marginVertical: 10,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  label: {
    marginBottom: 5,
  },
  roomCode: {
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 5,
  },
  status: {
    opacity: 0.7,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  button: {
    flex: 1,
  },
  joinDialogContent: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
  },
  joinDialogLabel: {
    marginBottom: 5,
  },
  codeInput: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 260,
    borderRadius: 4,
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 4,
  },
})
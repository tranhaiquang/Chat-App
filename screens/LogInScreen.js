import React, { useState } from 'react'
import { Text, TouchableOpacity, View, Image, TextInput, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '../theme'
import { AntDesign, Entypo } from 'react-native-vector-icons'
import AuthController from '../controllers/AuthController';
import Toast from 'react-native-toast-message';

export default function LogInScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { handleLogIn } = AuthController();
    const handleLoginPress = async () => {
        const response = await handleLogIn(email, password);

        Toast.show({
            type: response.code === 'success' ? 'success' : 'error',
            text1: response.code === 'success' ? 'Success' : 'Error',
            text2: response.message,
            visibilityTime: 4000,
            autoHide: true,
            topOffset: 30,
            bottomOffset: 40,
        });

    }
    return (
        <ScrollView>
            <View className="flex-1" style={{ backgroundColor: theme.background(0.8) }}>
                <SafeAreaView className="flex" >
                    <View className="flex-row justify-start">
                        <TouchableOpacity onPress={() => navigation.goBack()} className="p-1 bg-white rounded ml-4">
                            <AntDesign name="arrowleft" size={25} color={theme.background(0.8)}></AntDesign>
                        </TouchableOpacity>
                    </View>
                    <View className="flex-row justify-center">
                        <Image className="w-60 h-60" source={require('../assets/login-img.png')}></Image>
                    </View>
                </SafeAreaView>
                <Toast />

                <View className="flex-1 bg-white mt-8" style={{ borderTopLeftRadius: 50, borderTopRightRadius: 50 }}>
                    <View className="flex-column p-8">
                        <View className="form space-y-3">
                            <Text className="ml-2 text-gray-600 font-semibold">Email Address</Text>
                            <TextInput value={email} onChangeText={value => setEmail(value)} className="bg-gray-100 p-2 rounded-2xl"></TextInput>
                            <Text className="ml-2 text-gray-600 font-semibold">Password</Text>
                            <TextInput value={password} onChangeText={value => setPassword(value)} secureTextEntry className="bg-gray-100 p-2 rounded-2xl"></TextInput>
                            <TouchableOpacity className="flex items-end ">
                                <Text className="ml-2 text-gray-600 font-semibold">Forgot Password?</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleLoginPress} className="p-3 rounded-xl" style={{ backgroundColor: theme.background(0.8) }}>
                                <Text className="text-lg text-gray-600 font-semibold text-center">
                                    Login
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <View className="space-y-4 mt-6">
                            <Text className="text-center font-bold text-gray-600 ">Continue With</Text>
                            <View className="flex-row justify-center space-x-40 ">
                                <TouchableOpacity className="bg-gray-100 p-1 rounded">
                                    <Entypo name="facebook" size={40} color={theme.background(0.8)}></Entypo>
                                </TouchableOpacity>
                                <TouchableOpacity className="bg-gray-100 p-1 rounded">
                                    <AntDesign name="google" size={40} color={theme.background(0.8)}></AntDesign>
                                </TouchableOpacity>
                            </View>
                            <View className="flex-row justify-center">
                                <Text className="font-bold text-gray-600">Don't have an account? </Text>
                                <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
                                    <Text className="font-bold" style={{ color: theme.background(0.8) }}>Sign Up</Text>
                                </TouchableOpacity>
                            </View>

                        </View>
                    </View>
                </View>
            </View>
        </ScrollView >
    )

}



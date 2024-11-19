import React from 'react'
import { Text, View, Image, TouchableOpacity, ScrollView, } from 'react-native'
import { theme } from '../theme'
import { SafeAreaView } from 'react-native-safe-area-context'
export default function WelcomeScreen({ navigation }) {
    return (

        <SafeAreaView className="flex-1" style={{ backgroundColor: theme.background(0.8) }}>
            <View className="flex-1 flex justify-around my-4">
                <Text className="text-white font-bold text-4xl text-center">AuthFlow</Text>
                <View className="flex-row justify-center">
                    <Image className="w-80 h-80" source={require("../assets/welcome-img.png")}></Image>
                </View>
                <View className="space-y-4">
                    <TouchableOpacity className="bg-white py-3 mx-6 rounded-xl" onPress={() => navigation.navigate("SignUp")}>
                        <Text className="text-center text-xl font-bold text-gray-600">Sign Up</Text>
                    </TouchableOpacity>
                    <View className=" flex-row justify-center">
                        <Text className="text-white font-semibold">Already have an account?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate("LogIn")}>
                            <Text className="text-gray-600 font-semibold"> Log In</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </SafeAreaView>

    )
}

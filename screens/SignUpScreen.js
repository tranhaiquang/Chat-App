import React, { useEffect, useState } from 'react'
import { Text, TouchableOpacity, View, Image, TextInput, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '../theme'
import { AntDesign, Entypo } from 'react-native-vector-icons'
import AuthController from '../controllers/AuthController';
import Toast from 'react-native-toast-message';
export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [imageUri, setImageUri] = useState('');
  const { handleCreateUser, handleSignInWithGoogle, pickImage, uploadImage} = AuthController();

  const handlePickImage = async () => {
    const uri = await pickImage(); // Call the imported pickImage function
    if (uri) {
      setImageUri(uri); // Update state with the picked image URI
    }
  }

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Passwords do not match',
        visibilityTime: 4000,
        autoHide: true,
        topOffset: 30,
        bottomOffset: 40,
      });
      return;
    }

    const result = await handleCreateUser(email, password, imageUri);
    //await uploadImage('file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252FAuthFlow-65f8aac5-6e0f-41c7-8ccd-c15b5be37bdc/ImagePicker/adfce39c-05b6-42ed-84ab-0fa652a001db.jpeg', 'abcasd')
    Toast.show({
      type: result.code === 'success' ? 'success' : 'error',
      text1: result.code === 'success' ? 'Success' : 'Error',
      text2: result.message || 'Sign up successful',
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 30,
      bottomOffset: 40,
    });
  }
  const handleSignUpWithGooglePress = async () => {
    const result = await handleSignInWithGoogle();
  }

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: theme.background(0.8) }}>
      <SafeAreaView className="flex" >
        <View className="flex-row justify-start">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-1 bg-white rounded ml-4">
            <AntDesign name="arrowleft" size={25} color={theme.background(1)}></AntDesign>
          </TouchableOpacity>
        </View>
        <View className="flex-row justify-center">
          <Image className="w-44 h-44" source={require('../assets/signup-img.png')}></Image>
        </View>
        <Toast />

      </SafeAreaView>
      <View className="flex-1 bg-white mt-8" style={{ borderTopLeftRadius: 50, borderTopRightRadius: 50 }}>
        <View className="flex-column p-8">
          <View className="form space-y-3">
            <Text className="ml-2 text-gray-600 font-semibold">Email Address</Text>
            <TextInput value={email} onChangeText={value => setEmail(value)} className="bg-gray-100 p-2 rounded-2xl"></TextInput>
            <Text className="ml-2 text-gray-600 font-semibold">Password</Text>
            <TextInput value={password} onChangeText={value => setPassword(value)} secureTextEntry className="bg-gray-100 p-2 rounded-2xl"></TextInput>
            <Text className="ml-2 text-gray-600 font-semibold">Confirm password</Text>
            <TextInput value={confirmPassword} onChangeText={value => setConfirmPassword(value)} secureTextEntry className="bg-gray-100 p-2 rounded-2xl"></TextInput>
            <TouchableOpacity className="flex items-end ">
              <Text className="ml-2 text-gray-600 font-semibold">Forgot Password?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSignUp} className="p-3 rounded-xl" style={{ backgroundColor: theme.background(0.8) }}>
              <Text className="text-lg text-gray-600 font-semibold text-center">
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
          <View className="space-y-4 mt-6">
            <Text className="text-center font-bold text-gray-600 ">Continue With</Text>
            <View className="flex-row justify-center space-x-40 ">
              <TouchableOpacity onPress={handlePickImage} className="bg-gray-100 p-1 rounded">
                <Entypo name="facebook" size={40} color={theme.background(0.8)}></Entypo>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSignUpWithGooglePress} className="bg-gray-100 p-1 rounded">
                <AntDesign name="google" size={40} color={theme.background(0.8)}></AntDesign>
              </TouchableOpacity>
            </View>
            <View className="flex-row justify-center">
              <Text className="font-bold text-gray-600">Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("LogIn")}>
                <Text className="font-bold" style={{ color: theme.background(0.8) }}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  )

};



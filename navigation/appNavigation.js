import React from 'react'
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../screens/WelcomeScreen';
import HomeScreen from '../screens/HomeScreen';
import LogInScreen from '../screens/LogInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import AuthController from '../controllers/AuthController';

const Stack = createNativeStackNavigator();

export default function appNavigation() {
    const { user } = AuthController();
    if (user)
        return (
            <NavigationContainer>
                <Stack.Navigator initialRouteName="Home">
                    <Stack.Screen name="Home" options={{ headerShown: false }} component={HomeScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        )
    else {
        return (
            <NavigationContainer>
                <Stack.Navigator initialRouteName="Welcome">
                    <Stack.Screen name="Welcome" options={{ headerShown: false }} component={WelcomeScreen} />
                    <Stack.Screen name="SignUp" options={{ headerShown: false }} component={SignUpScreen} />
                    <Stack.Screen name="LogIn" options={{ headerShown: false }} component={LogInScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        )
    }
}

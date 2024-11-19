import AuthModel from '../models/AuthModel';
import { createUserWithEmailAndPassword, onAuthStateChanged, signOut, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendSignInLinkToEmail } from 'firebase/auth';
import { auth, db, storage } from '../config/firebaseConfig';
import { useState, useEffect } from 'react';
import { doc, setDoc } from "firebase/firestore";
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function AuthController() {
    const [user, setUser] = useState(null);
    const [initializing, setInitializing] = useState(true);

    const actionCodeSettings = {

        url: 'https://authflow-97602.firebaseapp.com',
        // This must be true.
        handleCodeInApp: true,
        iOS: {
            bundleId: 'com.yourcompany.authflow'
        },
        android: {
            packageName: 'com.yourcompany.authflow',
            installApp: true,
            minimumVersion: '12'
        },

    };
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, user => {

            if (user)
                setUser(user);
            else
                setUser(null);
        });
        return unsub;
    })

    const sendEmailLink = async (email) => {
        try {
            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            // Save the email locally so you don't need to ask the user for it again
            window.localStorage.setItem('emailForSignIn', email);
            return { code: 'success', message: 'Email link sent successfully' };
        } catch (error) {
            console.error(error);
            return { code: error.code, message: error.message };
        }
    };


    const handleCreateUser = async (email, password, imageUri) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log(user);

            // add new user to Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: email,
                // upload avatar to Firebase storage with uid as file name
                imageUri: await uploadImage(imageUri, user.uid)
            });


        } catch (error) {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.log(errorCode, errorMessage);
            return { code: errorCode, message: errorMessage };
        }
    };

    const handleLogIn = async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log(user);
            return { code: 'success', message: 'User logged in successfully' };
        } catch (error) {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.log(errorCode);
            return { code: errorCode, message: errorMessage };
        }
    };

    const handleSignInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
        try {
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential.accessToken;
            console.log(token);
            return { code: 'success', message: 'Google sign-in successful' };
        } catch (error) {
            console.log(error);
            return { code: error.code, message: error.message };
        }
    }

    const handleSignOut = async () => {
        signOut(auth).then(() => {
            // Sign-out successful.
        }).catch((error) => {
            console.log(error);
        });
    };

    const pickImage = async () => {
        // No permissions request is necessary for launching the image library
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            aspect: [3, 3],
            quality: 1,
        });

        console.log(result);

        if (!result.canceled) {
            return result.assets[0].uri;
        }

        return null;
    };

    const uploadImage = async (imageUri, uid) => {
        if (!imageUri) {
            console.error("No image URI provided.");
            return null; // Return null if there's no image URI
        }

        try {
            const response = await fetch(imageUri);
            // Check if the fetch was successful
            if (!response.ok) {
                console.error("Failed to fetch image:", response.statusText);
                return null;
            }

            const blob = await response.blob();
            const storageRef = ref(storage, `avatars/${uid}.jpg`);
            const snapshot = await uploadBytes(storageRef, blob);
            return await getDownloadURL(snapshot.ref);
        } catch (error) {
            console.error("Error uploading image:", error);
            return null; // Return null in case of an error
        }
    };

    return {
        user,
        handleCreateUser,
        handleSignOut,
        handleLogIn,
        handleSignInWithGoogle,
        pickImage,
        uploadImage
    };
}


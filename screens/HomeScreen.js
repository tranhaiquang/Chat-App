import { useEffect, React, useState } from 'react'
import { Text, View, TouchableOpacity, Platform, StatusBar, Image, FlatList } from 'react-native'
import { theme } from '../theme'
import { SafeAreaView, useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context'
import AuthController from '../controllers/AuthController';
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function HomeScreen() {
    {
        const { handleSignOut } = AuthController();
        const { top } = useSafeAreaInsets();
        const storage = getStorage();
        const [data, setData] = useState([]);
        const [avatarUrl, setAvatarUrl] = useState('');
        const [error, setError] = useState(null);
        const [userUid, setUserUid] = useState(null);
        const [loading, setLoading] = useState(true); // Set loading to true initially



        const getAvatarUrlFromGS = async (uid) => {
            try {
                // Create a reference using the "gs://" URL
                const fileRef = ref(storage, `gs://authflow-97602.appspot.com/avatars/${uid}.jpg`);
                // Get the download URL
                const url = await getDownloadURL(fileRef);
                return url;
            } catch (error) {
                console.error("Error fetching file URL:", error);
                throw error;  // Rethrow error for handling in the calling code
            }
        };

        useEffect(() => {
            const auth = getAuth();
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) {
                    setUserUid(user.uid); // This will trigger the second useEffect when userUid is updated
                } else {
                    setUserUid(null);
                }
            });
            return () => unsubscribe();
        }, []); // Run once on mount

        useEffect(() => {
            if (!userUid) return; // Only run when userUid is available

            const fetchData = async () => {
                setLoading(true);
                try {
                    const url = await getAvatarUrlFromGS(userUid);
                    setAvatarUrl(url); // Set avatarUrl to use in chatData

                    const chatData = [
                        {
                            username: 'Girl',
                            imageUrl: url, // Use the resolved URL directly here
                            lastMessage: 'Welcome to the chat!',
                        },
                        {
                            username: 'Another Girl',
                            imageUrl: url,
                            lastMessage: 'Hello World',
                        },
                    ];
                    setData(chatData);
                } catch (err) {
                    setError("Failed to load image.");
                } finally {
                    setLoading(false);
                }
            };

            fetchData();
        }, [userUid]); // Run whenever userUid changes


        const ChatItem = ({ username, imageUrl, lastMessage }) => (
            <View className="flex-row mx-2 py-2 items-center border-b border-b-neutral-200">
                <Image className="h-12 w-12 rounded-2xl" source={{ uri: imageUrl }}></Image>
                <View className="flex px-2">
                    <Text className="text-lg font-bold">{username}</Text>
                    <Text className="text-xs font-bold text-gray-400">{lastMessage}</Text>
                </View>
            </View>
        );
        return (
            <>
                {loading ? (
                    <View>
                        <Text>Loading...</Text>
                    </View>
                )
                    : (
                        <SafeAreaView className="flex-1" >
                            <StatusBar translucent backgroundColor="transparent" />

                            <View style={{
                                backgroundColor: theme.background(0.8),
                                height: StatusBar.currentHeight + 40,
                                paddingTop: StatusBar.currentHeight
                            }} className="flex-row absolute justify-between right-0 left-0 px-4 rounded-2xl ">

                                {/* Header with title "Chats" and an icon on the right */}
                                <View>
                                    <Text className="text-white font-bold text-2xl">Chats</Text>
                                </View>
                                <View>
                                    <Image source={{ uri: avatarUrl }} className=" h-9 w-9 rounded-2xl"></Image>
                                </View>
                            </View>
                            <View style={{ marginTop: StatusBar.currentHeight }}>
                                <FlatList
                                    data={data}
                                    renderItem={({ item }) => <ChatItem username={item.username} imageUrl={item.imageUrl} lastMessage={item.lastMessage} />}
                                    keyExtractor={ChatItem => ChatItem.id}
                                />
                                <TouchableOpacity onPress={handleSignOut}>
                                    <Text>Sign Out</Text>
                                </TouchableOpacity>
                            </View>

                        </SafeAreaView>
                    )}
            </>
        )
    }
}

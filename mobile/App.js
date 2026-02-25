import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, SafeAreaView, FlatList, KeyboardAvoidingView, Platform, Image, Keyboard, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from './firebaseConfig';
import { collection, query, where, getDocs, doc, setDoc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

import io from 'socket.io-client';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

export default function App() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [allSongs, setAllSongs] = useState([]);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tempName, setTempName] = useState('');
  const [currentGreeting, setCurrentGreeting] = useState('Praise the Lord!');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const welcomeFadeAnim = useRef(new Animated.Value(0)).current;
  const welcomeScaleAnim = useRef(new Animated.Value(0.9)).current;
  const greetingFadeAnim = useRef(new Animated.Value(0)).current;

  // Add Song State
  const [newTitle, setNewTitle] = useState('');
  const [newId, setNewId] = useState('');
  const [newCategory, setNewCategory] = useState('English Choruses');
  const [newLyrics, setNewLyrics] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Data
  const [schedule, setSchedule] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Christian Greetings List
  const greetings = [
    "Praise the Lord!",
    "Shalom!",
    "Grace and Peace!",
    "God Bless You!",
    "Blessings!",
    "Joy in the Lord!"
  ];

  // Random Bible Verses for Worship
  const bibleVerses = [
    { text: "Enter his gates with thanksgiving and his courts with praise; give thanks to him and praise his name.", ref: "Psalm 100:4" },
    { text: "Great is the Lord and most worthy of praise; his greatness no one can fathom.", ref: "Psalm 145:3" },
    { text: "Let everything that has breath praise the Lord. Praise the Lord.", ref: "Psalm 150:6" },
    { text: "I will praise you, Lord my God, with all my heart; I will glorify your name forever.", ref: "Psalm 86:12" },
    { text: "He is the one you praise; he is your God, who performed for you wonders you saw with your own eyes.", ref: "Deuteronomy 10:21" },
    { text: "I will bless the Lord at all times; his praise shall continually be in my mouth.", ref: "Psalm 34:1" },
    { text: "Sing to the Lord a new song; sing to the Lord, all the earth.", ref: "Psalm 96:1" },
    { text: "Shout for joy to the Lord, all the earth. Worship the Lord with gladness; come before him with joyful songs.", ref: "Psalm 100:1-2" },
    { text: "Praise the Lord. How good it is to sing praises to our God, how pleasant and fitting to praise him!", ref: "Psalm 147:1" },
    { text: "Come, let us sing for joy to the Lord; let us shout aloud to the Rock of our salvation.", ref: "Psalm 95:1" },
    { text: "For the Lord is the great God, the great King above all gods.", ref: "Psalm 95:3" },
    { text: "Come, let us bow down in worship, let us kneel before the Lord our Maker.", ref: "Psalm 95:6" },
    { text: "I will exalt you, my God the King; I will praise your name for ever and ever.", ref: "Psalm 145:1" },
    { text: "Every day I will praise you and extol your name for ever and ever.", ref: "Psalm 145:2" },
    { text: "My soul, praise the Lord; all my inmost being, praise his holy name.", ref: "Psalm 103:1" },
    { text: "Praise the Lord, my soul, and forget not all his benefits.", ref: "Psalm 103:2" },
    { text: "Who forgives all your sins and heals all your diseases.", ref: "Psalm 103:3" },
    { text: "Praise the Lord. Praise the Lord from the heavens; praise him in the heights above.", ref: "Psalm 148:1" },
    { text: "Praise him, all his angels; praise him, all his heavenly hosts.", ref: "Psalm 148:2" },
    { text: "Praise him, sun and moon; praise him, all you shining stars.", ref: "Psalm 148:3" },
    { text: "Let them praise the name of the Lord, for at his command they were created.", ref: "Psalm 148:5" },
    { text: "Let them praise the name of the Lord, for his name alone is exalted; his splendor is above the earth and the heavens.", ref: "Psalm 148:13" },
    { text: "Sing to the Lord a new song, his praise in the assembly of his faithful people.", ref: "Psalm 149:1" },
    { text: "Praise the Lord. Praise God in his sanctuary; praise him in his mighty heavens.", ref: "Psalm 150:1" },
    { text: "Praise him for his acts of power; praise him for his surpassing greatness.", ref: "Psalm 150:2" },
    { text: "Praise him with the sounding of the trumpet, praise him with the harp and lyre.", ref: "Psalm 150:3" },
    { text: "Praise him with timbrel and dancing, praise him with the strings and pipe.", ref: "Psalm 150:4" },
    { text: "Praise him with the clash of cymbals, praise him with resounding cymbals.", ref: "Psalm 150:5" },
    { text: "Because your love is better than life, my lips will glorify you.", ref: "Psalm 63:3" },
    { text: "I will praise you as long as I live, and in your name I will lift up my hands.", ref: "Psalm 63:4" },
    { text: "Praise the Lord, all you servants of the Lord who minister by night in the house of the Lord.", ref: "Psalm 134:1" },
    { text: "Lift up your hands in the sanctuary and praise the Lord.", ref: "Psalm 134:2" },
    { text: "Through Jesus, therefore, let us continually offer to God a sacrifice of praise—the fruit of lips that openly profess his name.", ref: "Hebrews 13:15" },
    { text: "About midnight Paul and Silas were praying and singing hymns to God, and the other prisoners were listening to them.", ref: "Acts 16:25" },
    { text: "Speak to one another with psalms, hymns, and songs from the Spirit. Sing and make music from your heart to the Lord.", ref: "Ephesians 5:19" },
    { text: "Always giving thanks to God the Father for everything, in the name of our Lord Jesus Christ.", ref: "Ephesians 5:20" },
    { text: "Let the message of Christ dwell among you richly... singing to God with gratitude in your hearts.", ref: "Colossians 3:16" },
    { text: "And whatever you do, whether in word or deed, do it all in the name of the Lord Jesus, giving thanks to God the Father through him.", ref: "Colossians 3:17" },
    { text: "Praise be to the God and Father of our Lord Jesus Christ! In his great mercy he has given us new birth into a living hope.", ref: "1 Peter 1:3" },
    { text: "But you are a chosen people... that you may declare the praises of him who called you out of darkness into his wonderful light.", ref: "1 Peter 2:9" },
    { text: "Worthy is the Lamb, who was slain, to receive power and wealth and wisdom and strength and honor and glory and praise!", ref: "Revelation 5:12" },
    { text: "To him who sits on the throne and to the Lamb be praise and honor and glory and power, for ever and ever!", ref: "Revelation 5:13" },
    { text: "You are worthy, our Lord and God, to receive glory and honor and power, for you created all things.", ref: "Revelation 4:11" },
    { text: "Salvation belongs to our God, who sits on the throne, and to the Lamb.", ref: "Revelation 7:10" },
    { text: "Amen! Praise and glory and wisdom and thanks and honor and power and strength be to our God for ever and ever. Amen!", ref: "Revelation 7:12" },
    { text: "Great and marvelous are your deeds, Lord God Almighty. Just and true are your ways, King of the nations.", ref: "Revelation 15:3" },
    { text: "Who will not fear you, Lord, and bring glory to your name? For you alone are holy.", ref: "Revelation 15:4" },
    { text: "For the Lord takes delight in his people; he crowns the humble with victory.", ref: "Psalm 149:4" },
    { text: "I will give thanks to the Lord because of his righteousness; I will sing the praises of the name of the Lord Most High.", ref: "Psalm 7:17" },
    { text: "O Lord, our Lord, how majestic is your name in all the earth!", ref: "Psalm 8:1" },
    { text: "I will sing to the Lord all my life; I will sing praise to my God as long as I live.", ref: "Psalm 104:33" },
    { text: "Give thanks to the Lord, call on his name; make known among the nations what he has done.", ref: "Psalm 105:1" },
    { text: "Sing to him, sing praise to him; tell of all his wonderful acts.", ref: "Psalm 105:2" },
    { text: "Glory in his holy name; let the hearts of those who seek the Lord rejoice.", ref: "Psalm 105:3" },
    { text: "Give thanks to the Lord, for he is good; his love endures forever.", ref: "Psalm 107:1" },
    { text: "Let them give thanks to the Lord for his unfailing love and his wonderful deeds for mankind.", ref: "Psalm 107:8" },
    { text: "He has put a new song in my mouth, a hymn of praise to our God.", ref: "Psalm 40:3" },
    { text: "Seven times a day I praise you for your righteous laws.", ref: "Psalm 119:164" },
    { text: "May my lips overflow with praise, for you teach me your decrees.", ref: "Psalm 119:171" },
    { text: "May my tongue sing of your word, for all your commands are righteous.", ref: "Psalm 119:172" },
    { text: "The Lord is my strength and my shield; my heart trusts in him, and he helps me.", ref: "Psalm 28:7" },
    { text: "My heart leaps for joy, and with my song I praise him.", ref: "Psalm 28:7" },
    { text: "Rejoice in the Lord always. I will say it again: Rejoice!", ref: "Philippians 4:4" },
    { text: "Is anyone among you in trouble? Let them pray. Is anyone happy? Let them sing songs of praise.", ref: "James 5:13" },
    { text: "Sing to the Lord, for he has done glorious things; let this be known to all the world.", ref: "Isaiah 12:5" },
    { text: "Lord, you are my God; I will exalt you and praise your name, for in perfect faithfulness you have done wonderful things.", ref: "Isaiah 25:1" },
    { text: "Ascribe to the Lord the glory due his name; bring an offering and come before him.", ref: "1 Chronicles 16:29" },
    { text: "Worship the Lord in the splendor of his holiness.", ref: "1 Chronicles 16:29" },
    { text: "Let the heavens rejoice, let the earth be glad; let them say among the nations, 'The Lord reigns!'", ref: "1 Chronicles 16:31" },
    { text: "Give thanks to the Lord, for he is good; his love endures forever.", ref: "1 Chronicles 16:34" },
    { text: "Praise be to you, Lord, the God of our father Israel, from everlasting to everlasting.", ref: "1 Chronicles 29:10" },
    { text: "Yours, Lord, is the greatness and the power and the glory and the majesty and the splendor, for everything in heaven and earth is yours.", ref: "1 Chronicles 29:11" },
    { text: "Wealth and honor come from you; you are the ruler of all things.", ref: "1 Chronicles 29:12" },
    { text: "Now, our God, we give you thanks, and praise your glorious name.", ref: "1 Chronicles 29:13" },
    { text: "Stand up and praise the Lord your God, who is from everlasting to everlasting.", ref: "Nehemiah 9:5" },
    { text: "Blessed be your glorious name, and may it be exalted above all blessing and praise.", ref: "Nehemiah 9:5" },
    { text: "You alone are the Lord. You made the heavens, even the highest heavens, and all their starry host.", ref: "Nehemiah 9:6" },
    { text: "All the earth bows down to you; they sing praise to you, they sing the praises of your name.", ref: "Psalm 66:4" },
    { text: "Praise our God, all peoples, let the sound of his praise be heard.", ref: "Psalm 66:8" },
    { text: "This is the day the Lord has made; let us rejoice and be glad in it.", ref: "Psalm 118:24" },
    { text: "The Lord is my strength and my song; he has become my salvation.", ref: "Psalm 118:14" },
    { text: "Give thanks to the Lord, call on his name; make known among the nations what he has done.", ref: "1 Chronicles 16:8" },
    { text: "Sing to him, sing praise to him; tell of all his wonderful acts.", ref: "1 Chronicles 16:9" },
    { text: "Glory in his holy name; let the hearts of those who seek the Lord rejoice.", ref: "1 Chronicles 16:10" },
    { text: "Sing to the Lord, all the earth; proclaim his salvation day after day.", ref: "1 Chronicles 16:23" },
    { text: "Declare his glory among the nations, his marvelous deeds among all peoples.", ref: "1 Chronicles 16:24" },
    { text: "For great is the Lord and most worthy of praise; he is to be feared above all gods.", ref: "1 Chronicles 16:25" },
    { text: "Praise the Lord. Praise the name of the Lord; praise him, you servants of the Lord.", ref: "Psalm 135:1" },
    { text: "Praise the Lord, for the Lord is good; sing praise to his name, for that is pleasant.", ref: "Psalm 135:3" },
    { text: "From the rising of the sun to the place where it sets, the name of the Lord is to be praised.", ref: "Psalm 113:3" },
    { text: "May the glory of the Lord endure forever; may the Lord rejoice in his works.", ref: "Psalm 104:31" },
    { text: "I will sing to the Lord, for he has been good to me.", ref: "Psalm 13:6" },
    { text: "Awake, my soul! Awake, harp and lyre! I will awaken the dawn.", ref: "Psalm 57:8" },
    { text: "I will praise you, Lord, among the nations; I will sing of you among the peoples.", ref: "Psalm 57:9" },
    { text: "For great is your love, reaching to the heavens; your faithfulness reaches to the skies.", ref: "Psalm 57:10" },
    { text: "Be exalted, O God, above the heavens; let your glory be over all the earth.", ref: "Psalm 57:11" },
    { text: "My soul yearns, even faints, for the courts of the Lord; my heart and my flesh cry out for the living God.", ref: "Psalm 84:2" },
    { text: "Better is one day in your courts than a thousand elsewhere.", ref: "Psalm 84:10" },
    { text: "Blessed are those who dwell in your house; they are ever praising you.", ref: "Psalm 84:4" },
    { text: "Holy, holy, holy is the Lord God Almighty, who was, and is, and is to come.", ref: "Revelation 4:8" }
  ];

  const [currentVerse, setCurrentVerse] = useState(bibleVerses[0]);

  // Startup Logic: Splash & Loading Name
  useEffect(() => {
    const initApp = async () => {
      try {
        // Authenticate anonymously for Firestore access
        await signInAnonymously(auth);
        console.log("Authenticated anonymously");
        setIsAuthenticated(true);

        const savedName = await AsyncStorage.getItem('user_name');
        if (savedName) {
          setUserName(savedName);
          const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
          setCurrentGreeting(randomGreeting);
          const randomVerse = bibleVerses[Math.floor(Math.random() * bibleVerses.length)];
          setCurrentVerse(randomVerse);
        } else {
          setShowOnboarding(true);
        }

        // 1. Splash Animation Sequence
        // Phase 1: Logo Fade In & Scale Up
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            useNativeDriver: true,
          })
        ]).start(() => {
          setTimeout(() => {
            // Phase 2: Logo Fade Out
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }).start(() => {
              // Phase 3: Welcome Message Fade In & Out
              Animated.parallel([
                Animated.timing(welcomeFadeAnim, {
                  toValue: 1,
                  duration: 800,
                  useNativeDriver: true,
                }),
                Animated.spring(welcomeScaleAnim, {
                  toValue: 1,
                  friction: 4,
                  useNativeDriver: true,
                })
              ]).start(() => {
                setTimeout(() => {
                  Animated.timing(welcomeFadeAnim, {
                    toValue: 0,
                    duration: 800,
                    useNativeDriver: true,
                  }).start(() => {
                    setIsAppLoading(false);
                    // Phase 4: Main Content View
                    Animated.timing(greetingFadeAnim, {
                      toValue: 1,
                      duration: 800,
                      delay: 200,
                      useNativeDriver: true,
                    }).start();
                  });
                }, 2000); // Show Welcome for 2 seconds
              });
            });
          }, 1500); // Show Logo for 1.5 seconds
        });

      } catch (e) {
        console.error("Initialization error:", e);
        setIsAppLoading(false);
      }
    };

    initApp();
  }, []);

  const buildNumber = Constants.expoConfig.extra.buildNumber || '0';
  const appVersion = Constants.expoConfig.version || '1.0.0';

  const renderFooter = () => (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        © ChurchLyriXApp | v{appVersion} (Build {buildNumber})
      </Text>
    </View>
  );

  // OTA Updates Logic: Check for updates on startup
  useEffect(() => {
    async function onFetchUpdateAsync() {
      // Don't check in dev mode or if updates are disabled
      if (__DEV__ || !Updates.isEnabled) return;

      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            "Update Available",
            "A new version of the app is available. Restart now to apply?",
            [
              { text: "Later", style: "cancel" },
              {
                text: "Restart Now",
                onPress: async () => {
                  try {
                    await Updates.reloadAsync();
                  } catch (e) {
                    // Silently fail or log to telemetry, don't block user
                    console.log("Reload error:", e);
                  }
                }
              }
            ]
          );
        }
      } catch (error) {
        // Silently log the error instead of Alerting to avoid blocking the user
        console.log(`Update check failed: ${error.message}`);
      }
    }

    onFetchUpdateAsync();
  }, []);

  const handleOnboardingSubmit = async () => {
    if (!tempName.trim()) {
      Alert.alert("Welcome", "Please enter your name to continue");
      return;
    }
    try {
      await AsyncStorage.setItem('user_name', tempName.trim());
      setUserName(tempName.trim());
      setShowOnboarding(false);
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
      setCurrentGreeting(randomGreeting);
      const randomVerse = bibleVerses[Math.floor(Math.random() * bibleVerses.length)];
      setCurrentVerse(randomVerse);

      // Start the greeting float-in animation
      Animated.timing(greetingFadeAnim, {
        toValue: 1,
        duration: 1000,
        delay: 200,
        useNativeDriver: true,
      }).start();
    } catch (e) {
      Alert.alert("Error", "Could not save your name");
    }
  };

  // Firestore Sync
  useEffect(() => {
    if (!isAuthenticated) return;

    // Subscribe to Sunday Service Schedule
    const scheduleRef = doc(db, "schedules", "sunday-service");
    const unsubscribe = onSnapshot(scheduleRef, (docSnap) => {
      if (docSnap.exists()) {
        setSchedule(docSnap.data().items || []);
      }
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  // Tab Handlers
  // Fetch is auto via listener

  // Fetch All Songs for Client-Side Search
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchSongs = async () => {
      try {
        const q = query(collection(db, "songs"));
        const querySnapshot = await getDocs(q);
        const songs = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          let rawPreview = data.slides ? data.slides[0].split('\n')[0] : '';

          // Clean preview: Remove leading numbers/dots and Title redundancy
          let cleanedPreview = rawPreview
            .replace(/^\d+[\.\s]*/, '') // Remove leading numbers like "1. " or "1 "
            .trim();

          // Remove title if it's identical to the start of lyrics
          if (data.title && cleanedPreview.toLowerCase().startsWith(data.title.toLowerCase())) {
            cleanedPreview = cleanedPreview.substring(data.title.length).replace(/^[\s,.-]+/, '').trim();
          }

          // Truncate if still too long (especially for Telugu/complex scripts)
          if (cleanedPreview.length > 80) {
            cleanedPreview = cleanedPreview.substring(0, 77) + '...';
          }

          songs.push({
            ...data,
            displayTitle: data.title || cleanedPreview,
            displayPreview: cleanedPreview
          });
        });
        setAllSongs(songs);
        console.log(`Loaded ${songs.length} songs for offline search`);
      } catch (e) {
        console.error("Error loading songs:", e);
      }
    };
    fetchSongs();
  }, [isAuthenticated]);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    const isNumeric = /^\d+$/.test(q);
    Keyboard.dismiss();

    const results = allSongs.filter(song => {
      const textToSearch = [
        song.title || '',
        song.id ? song.id.toString() : '',
        song.displayPreview || ''
      ].join(' ').toLowerCase();

      return textToSearch.includes(q);
    });

    // Natural Sort
    results.sort((a, b) => {
      return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
    });

    setSearchResults(results.slice(0, 50));
  };

  const handleEdit = (song) => {
    setNewId(song.id || '');
    setNewTitle(song.title || '');
    setNewCategory(song.category || 'English Choruses');
    setNewLyrics(song.slides ? song.slides.join('\n\n') : '');
    setIsEditing(true);
    setActiveTab('add');
  };

  const addToSchedule = async (songId) => {
    try {
      // Prevent duplicates
      if (schedule.some(item => item.songId === songId)) {
        Alert.alert("Already Added", "This song is already in the schedule.");
        return;
      }

      // Optimization: Find song in local cache instead of fetching
      const song = allSongs.find(s => s.id === songId);

      if (!song) {
        Alert.alert("Error", "Song not found in cache");
        return;
      }

      // Ensure we only store the TITLE (first line), not full lyrics
      const rawTitle = song.displayTitle || song.title || "Unknown";
      // Optional: Strip leading numbers if present (e.g. "1. Amazing Grace" -> "Amazing Grace")
      const cleanTitle = rawTitle.replace(/^\d+\.?\s*/, '').trim();

      const newItem = {
        instanceId: Date.now().toString(),
        songId: song.id,
        title: cleanTitle,
        category: song.category || "General"
      };

      const newSchedule = [...schedule, newItem];

      // Navigate immediately for "fast" feel, sync happens in background
      setActiveTab('schedule');

      await setDoc(doc(db, "schedules", "sunday-service"), { items: newSchedule });
      // Removed blocking Alert for speed
    } catch (e) {
      Alert.alert("Error", "Could not add to schedule: " + e.message);
    }
  }

  const removeFromSchedule = async (instanceId) => {
    const newSchedule = schedule.filter(i => i.instanceId !== instanceId);
    await setDoc(doc(db, "schedules", "sunday-service"), { items: newSchedule });
  }

  // Auto-ID Logic
  useEffect(() => {
    if (activeTab === 'add' && !isEditing) {
      const specialSongs = allSongs.filter(s =>
        (s.category && s.category === 'Special Songs') ||
        (s.id && s.id.toString().startsWith('S'))
      );

      if (specialSongs.length > 0) {
        // Find max ID number
        const maxId = specialSongs.reduce((max, s) => {
          if (!s.id) return max;
          const num = parseInt(s.id.toString().replace(/\D/g, '')) || 0;
          return num > max ? num : max;
        }, 0);
        setNewId(`S${maxId + 1}`);
        setNewCategory('Special Songs');
      } else {
        setNewId('S1');
        setNewCategory('Special Songs');
      }
    }
  }, [activeTab, allSongs]);

  // Keyboard Listeners to hide bottom bar
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  const renderAddSong = () => {
    const generateId = () => {
      const specialSongs = allSongs.filter(s =>
        (s.category && s.category === 'Special Songs') ||
        (s.id && s.id.toString().startsWith('S'))
      );

      let nextId = 'S1';
      if (specialSongs.length > 0) {
        const maxId = specialSongs.reduce((max, s) => {
          if (!s.id) return max;
          const num = parseInt(s.id.toString().replace(/\D/g, '')) || 0;
          return num > max ? num : max;
        }, 0);
        nextId = `S${maxId + 1}`;
      }
      setNewId(nextId);
      setNewCategory('Special Songs');
      Alert.alert("ID Generated", `Next ID is ${nextId}`);
    };

    const saveSong = async () => {
      if (!newTitle || !newId || !newLyrics) {
        Alert.alert("Error", "Please fill Title, ID, and Lyrics");
        return;
      }
      try {
        const docRef = doc(db, "songs", newId.trim());

        if (!isEditing) {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            Alert.alert("Error", "Song ID already exists!");
            return;
          }
        }

        const slides = newLyrics.split('\n\n').map(s => s.trim()).filter(Boolean);

        await setDoc(docRef, {
          id: newId.trim(),
          title: newTitle.trim(),
          category: newCategory,
          slides: slides,
          searchKey: newTitle.toLowerCase()
        });

        Alert.alert("Success", isEditing ? "Song Updated!" : "Song Saved!");
        setNewTitle(''); setNewId(''); setNewLyrics('');
        setIsEditing(false);

        // Refresh song list
        const q = query(collection(db, "songs"));
        const querySnapshot = await getDocs(q);
        const songs = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const firstLine = data.slides ? data.slides[0].split('\n')[0].replace(/^\d+[\.\s]*/, '').trim() : '';
          songs.push({
            ...data,
            displayTitle: data.title || firstLine,
            displayPreview: firstLine
          });
        });
        setAllSongs(songs);
      } catch (e) {
        Alert.alert("Error", e.message);
      }
    };

    return (
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
        {renderLogo()}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={[styles.heading, { marginBottom: 0 }]}>{isEditing ? "Edit Song" : "Add New Song"}</Text>
          {isEditing && (
            <TouchableOpacity onPress={() => { setIsEditing(false); setNewTitle(''); setNewId(''); setNewLyrics(''); setActiveTab('search'); }}>
              <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.label}>Song ID</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={newId} onChangeText={setNewId} placeholder="e.g. S100" placeholderTextColor="#666" />
          <TouchableOpacity style={styles.secondaryButton} onPress={generateId}>
            <Text style={styles.secondaryButtonText}>🔄 Auto-ID</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={newTitle} onChangeText={setNewTitle} placeholder="Song Title" placeholderTextColor="#666" />

        <Text style={styles.label}>Lyrics (Double spacing = New Slide)</Text>
        <TextInput
          style={[styles.input, { height: 150, textAlignVertical: 'top' }]}
          value={newLyrics}
          onChangeText={setNewLyrics}
          multiline={true}
          placeholder="Verse 1...&#10;&#10;Chorus..."
          placeholderTextColor="#666"
        />

        <Text style={styles.debugText}>Database: {allSongs.length} songs loaded</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={saveSong}>
          <Text style={styles.primaryButtonText}>{isEditing ? "Update Song" : "Save Song"}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // useMemo to prevent re-rendering/blinking
  const BottomTabs = React.useMemo(() => (
    <View style={styles.tabContainer}>
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === 'schedule' && styles.activeTab]} onPress={() => setActiveTab('schedule')}>
          <Ionicons name={activeTab === 'schedule' ? "list" : "list-outline"} size={28} color={activeTab === 'schedule' ? "#6366f1" : "#9ca3af"} />
          <Text style={[styles.tabText, activeTab === 'schedule' && styles.activeTabText]}>Schedule</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tab, activeTab === 'add' && styles.activeTab]} onPress={() => setActiveTab('add')}>
          <View style={styles.addIconContainer}>
            <Ionicons name="add" size={32} color="white" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tab, activeTab === 'search' && styles.activeTab]} onPress={() => { setActiveTab('search'); setIsEditing(false); }}>
          <Ionicons name={activeTab === 'search' ? "search" : "search-outline"} size={28} color={activeTab === 'search' ? "#6366f1" : "#9ca3af"} />
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>Search</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [activeTab]);

  const renderLogo = () => (
    <View style={styles.logoContainer}>
      <Image
        source={require('./assets/branding_logo.png')}
        style={styles.logo}
      />
    </View>
  );

  const renderSchedule = () => (
    <View style={styles.content}>
      {renderLogo()}
      <Animated.View style={[styles.welcomeBanner, { opacity: greetingFadeAnim, transform: [{ translateY: greetingFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
        <Text style={styles.verseText}>{currentVerse.text}</Text>
        <Text style={styles.verseRef}>{currentVerse.ref}</Text>
      </Animated.View>
      <Text style={styles.heading}>Sunday Schedule ({schedule.length})</Text>
      <FlatList
        data={schedule}
        keyExtractor={(item) => item.instanceId}
        renderItem={({ item, index }) => (
          <View style={styles.listItem}>
            <View style={styles.itemMain}>
              <Text style={styles.itemIndex}>{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.itemSubtitle}>{item.category} • {item.songId}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => removeFromSchedule(item.instanceId)} style={styles.deleteButton}>
              <Text style={styles.deleteText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Schedule is empty.</Text>}
        contentContainerStyle={{ paddingBottom: 150 }}
      />
      {renderFooter()}
    </View>
  );

  const renderSearch = () => (
    <View style={styles.content}>
      {renderLogo()}
      <Text style={styles.heading}>Search Songs</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search songs..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.goButton} onPress={handleSearch}>
          <Ionicons name="arrow-forward" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.displayTitle}</Text>
              <Text style={styles.itemSubtitle}>{item.category} • {item.id}</Text>
            </View>
            <View style={{ gap: 8 }}>
              <TouchableOpacity style={styles.addButton} onPress={() => addToSchedule(item.id)}>
                <Text style={styles.addButtonText}>Add +</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addButton, { backgroundColor: '#4b5563' }]} onPress={() => handleEdit(item)}>
                <Text style={styles.addButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No results.</Text>}
        contentContainerStyle={{ paddingBottom: 150 }}
      />
      {renderFooter()}
    </View>
  );



  return (
    <SafeAreaView style={styles.container}>
      {isAppLoading ? (
        <View style={styles.splashContainer}>
          <Animated.View style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
            alignItems: 'center',
            position: 'absolute'
          }}>
            <Image source={require('./assets/branding_logo.png')} style={styles.splashLogo} />
            <Text style={styles.splashBranding}>LYRIX</Text>
            <Text style={styles.splashSlogan}>Worship in Harmony</Text>
          </Animated.View>

          <Animated.View style={{
            opacity: welcomeFadeAnim,
            transform: [{ scale: welcomeScaleAnim }],
            alignItems: 'center',
            position: 'absolute'
          }}>
            <Text style={styles.welcomeTitle}>{currentGreeting}</Text>
            <Text style={styles.welcomeName}>{userName}</Text>
          </Animated.View>
        </View>
      ) : showOnboarding ? (
        <View style={styles.onboardingContainer}>
          <Image source={require('./assets/branding_logo.png')} style={styles.onboardingLogo} />
          <Text style={styles.onboardingTitle}>Welcome to LyriX</Text>
          <Text style={styles.onboardingSubtitle}>Enter your name to personalize your experience</Text>
          <TextInput
            style={styles.onboardingInput}
            placeholder="Your Name"
            placeholderTextColor="#6b7280"
            value={tempName}
            onChangeText={setTempName}
            autoFocus
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleOnboardingSubmit}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            {activeTab === 'schedule' && renderSchedule()}
            {activeTab === 'add' && renderAddSong()}
            {activeTab === 'search' && renderSearch()}
          </KeyboardAvoidingView>
          {!isKeyboardVisible && BottomTabs}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', paddingTop: Platform.OS === 'android' ? 45 : 0 }, // Added top safe area
  centerContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', padding: 20 },

  content: { flex: 1, padding: 16 },

  title: { fontSize: 28, color: 'white', fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  label: { color: '#9ca3af', marginBottom: 8, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  input: {
    backgroundColor: '#1f2937',
    color: 'white',
    padding: 18,
    borderRadius: 16,
    marginBottom: 24,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151'
  },
  hint: { color: '#6b7280', textAlign: 'center', marginTop: 24 },
  debugText: { color: '#4b5563', textAlign: 'center', fontSize: 12, marginBottom: 12 },

  primaryButton: {
    backgroundColor: '#6366f1', // Indigo-500
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4,
    marginTop: 10,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryButtonText: { color: 'white', fontWeight: '800', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },

  secondaryButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4b5563'
  },
  secondaryButtonText: { color: '#e5e7eb', fontWeight: 'bold' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  status: { color: '#4ade80', fontWeight: 'bold' },
  heading: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },

  controlGrid: { flexDirection: 'row', gap: 16, marginBottom: 16, height: 160 },
  bigButton: { flex: 1, backgroundColor: '#2563eb', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  bigButtonText: { color: 'white', fontSize: 20, fontWeight: '900' },

  actionButton: { backgroundColor: '#374151', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  blackoutButton: { backgroundColor: '#dc2626' },
  actionButtonText: { color: 'white', fontWeight: 'bold' },

  // New Branding & Onboarding Styles
  splashContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' },
  splashLogo: { width: 120, height: 120, resizeMode: 'contain', marginBottom: 20 },
  splashBranding: { color: 'white', fontSize: 32, fontWeight: '900', letterSpacing: 8, marginBottom: 10 },
  splashSlogan: { color: '#6366f1', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2 },

  onboardingContainer: { flex: 1, backgroundColor: '#111827', padding: 30, justifyContent: 'center' },
  onboardingLogo: { width: 80, height: 80, resizeMode: 'contain', marginBottom: 24, alignSelf: 'center' },
  onboardingTitle: { color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  onboardingSubtitle: { color: '#9ca3af', fontSize: 16, textAlign: 'center', marginBottom: 40 },
  onboardingInput: {
    backgroundColor: '#1f2937',
    color: 'white',
    padding: 18,
    borderRadius: 16,
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 24,
    textAlign: 'center'
  },

  welcomeBanner: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 30,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3
  },
  verseText: {
    color: '#e5e7eb',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20
  },
  verseRef: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '700',
    fontStyle: 'italic'
  },
  welcomeTitle: {
    color: '#6366f1',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 10
  },
  welcomeName: {
    color: 'white',
    fontSize: 36,
    fontWeight: '900',
    fontStyle: 'italic'
  },

  logoContainer: { alignItems: 'center', marginBottom: 30, paddingTop: 10 },
  logo: { width: 80, height: 80, resizeMode: 'contain', marginBottom: 10 },
  brandingText: { color: 'white', fontSize: 20, fontWeight: '900', letterSpacing: 2 },

  headerLogoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingTop: 10 },
  headerLogo: { width: 32, height: 32, resizeMode: 'contain' },

  tabContainer: {
    position: 'absolute',
    bottom: 70, // Moved up even more as requested
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 30,
    height: 70,
    width: '100%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  tab: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  activeTab: {},
  tabText: { color: '#9ca3af', fontSize: 10, marginTop: 2, fontWeight: 'bold' },
  activeTabText: { color: '#6366f1', fontWeight: 'bold' },
  addIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    // Removed marginBottom to align with other tabs
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5
  },

  // List Styles
  listItem: { flexDirection: 'row', backgroundColor: '#1f2937', padding: 16, borderRadius: 12, marginBottom: 8, alignItems: 'center' },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  itemIndex: { color: '#6b7280', fontWeight: 'bold', marginRight: 12, width: 24 },
  itemTitle: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  itemSubtitle: { color: '#9ca3af', fontSize: 14, marginTop: 4 },

  deleteButton: { padding: 8 },
  deleteText: { fontSize: 20 },
  debugTextSub: { color: '#4b5563', fontSize: 10, marginTop: 2 },

  addButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80
  },
  addButtonText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },

  searchRow: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#1f2937',
    borderRadius: 30, // Pill shape like bottom bar
    paddingHorizontal: 20,
    paddingVertical: 5,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#374151'
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    color: 'white',
    paddingVertical: 15, // Taller touch area
    fontSize: 18,
    fontWeight: 'bold'
  },
  goButton: {
    backgroundColor: '#6366f1',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10
  },
  emptyText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  footer: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5
  }
});

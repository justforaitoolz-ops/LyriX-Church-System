import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Button, TouchableOpacity, ScrollView, Alert, SafeAreaView, FlatList, KeyboardAvoidingView, Platform, Image, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, doc, setDoc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';

import io from 'socket.io-client';

export default function App() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [allSongs, setAllSongs] = useState([]);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  // Add Song State
  const [newTitle, setNewTitle] = useState('');
  const [newId, setNewId] = useState('');
  const [newCategory, setNewCategory] = useState('English Choruses');
  const [newLyrics, setNewLyrics] = useState('');

  // Data
  const [schedule, setSchedule] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Firestore Sync
  useEffect(() => {
    // Subscribe to Sunday Service Schedule
    const scheduleRef = doc(db, "schedules", "sunday-service");
    const unsubscribe = onSnapshot(scheduleRef, (docSnap) => {
      if (docSnap.exists()) {
        setSchedule(docSnap.data().items || []);
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  useEffect(() => {
    // Subscribe to Sunday Service Schedule
    const scheduleRef = doc(db, "schedules", "sunday-service");
    const unsubscribe = onSnapshot(scheduleRef, (docSnap) => {
      if (docSnap.exists()) {
        setSchedule(docSnap.data().items || []);
      }
    });
    return () => unsubscribe();
  }, []);

  // Tab Handlers
  // Fetch is auto via listener

  // Fetch All Songs for Client-Side Search
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const q = query(collection(db, "songs"));
        const querySnapshot = await getDocs(q);
        const songs = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          songs.push({ ...data, preview: data.slides ? data.slides[0] : '' });
        });
        setAllSongs(songs);
        console.log(`Loaded ${songs.length} songs for offline search`);
      } catch (e) {
        console.error("Error loading songs:", e);
      }
    };
    fetchSongs();
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    const isNumeric = /^\d+$/.test(q);

    const results = allSongs.filter(song => {
      const textToSearch = [
        song.title || '',
        song.id ? song.id.toString() : '',
        song.preview || ''
      ].join(' ').toLowerCase();

      return textToSearch.includes(q);
    });

    // Natural Sort
    results.sort((a, b) => {
      return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
    });

    setSearchResults(results.slice(0, 50));
  };

  const addToSchedule = async (songId) => {
    try {
      // Optimization: Find song in local cache instead of fetching
      const song = allSongs.find(s => s.id === songId);

      if (!song) {
        Alert.alert("Error", "Song not found in cache");
        return;
      }

      // Ensure we only store the TITLE (first line), not full lyrics
      const rawTitle = song.title || (song.preview ? song.preview.split('\n')[0] : "Unknown");
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
    if (activeTab === 'add') {
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
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          Alert.alert("Error", "Song ID already exists!");
          return;
        }

        const slides = newLyrics.split('\n\n').map(s => s.trim()).filter(Boolean);

        await setDoc(docRef, {
          id: newId.trim(),
          title: newTitle.trim(),
          category: newCategory,
          slides: slides,
          searchKey: newTitle.toLowerCase()
        });

        Alert.alert("Success", "Song Saved!");
        setNewTitle(''); setNewId(''); setNewLyrics('');

        // Refresh song list
        const q = query(collection(db, "songs"));
        const querySnapshot = await getDocs(q);
        const songs = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          songs.push({ ...data, preview: data.slides ? data.slides[0] : '' });
        });
        setAllSongs(songs);
      } catch (e) {
        Alert.alert("Error", e.message);
      }
    };

    return (
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
        {renderLogo()}
        <Text style={styles.heading}>Add New Song</Text>

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
          <Text style={styles.primaryButtonText}>Save Song</Text>
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

        <TouchableOpacity style={[styles.tab, activeTab === 'search' && styles.activeTab]} onPress={() => setActiveTab('search')}>
          <Ionicons name={activeTab === 'search' ? "search" : "search-outline"} size={28} color={activeTab === 'search' ? "#6366f1" : "#9ca3af"} />
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>Search</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [activeTab]);

  const renderLogo = () => (
    <View style={{ alignItems: 'center', marginBottom: 20, paddingTop: 10 }}>
      <Image source={require('./assets/logo.png')} style={{ width: 100, height: 100, resizeMode: 'contain' }} />
    </View>
  );

  const renderSchedule = () => (
    <View style={styles.content}>
      {renderLogo()}
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
    </View>
  );

  const renderSearch = () => (
    <View style={styles.content}>
      {renderLogo()}
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
              <Text style={styles.itemTitle}>{item.preview?.split('\n')[0]}</Text>
              <Text style={styles.itemSubtitle}>{item.category} • {item.id}</Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={() => addToSchedule(item.id)}>
              <Text style={styles.addButtonText}>Add +</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No results.</Text>}
        contentContainerStyle={{ paddingBottom: 150 }}
      />
    </View>
  );



  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {activeTab === 'schedule' && renderSchedule()}
        {activeTab === 'add' && renderAddSong()}
        {activeTab === 'search' && renderSearch()}
      </KeyboardAvoidingView>
      {BottomTabs}
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

  tabContainer: {
    position: 'absolute',
    bottom: 50, // Moved up as requested
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
  itemTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  itemSubtitle: { color: '#9ca3af', fontSize: 12, marginTop: 4 },

  deleteButton: { padding: 8 },
  deleteText: { fontSize: 20 },

  addButton: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: 'white', fontWeight: 'bold' },

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
    fontSize: 16,
    fontWeight: '500'
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
  emptyText: { color: '#6b7280', textAlign: 'center', marginTop: 40 }
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { LogOut, Menu, Plus, User } from '@hugeicons/core-free-icons';
import { useAppContext } from '../../context/AppContext';
import { ConsoleContext } from '../../context/ConsoleContext';
import { AnchoredPopover } from '../ui/AnchoredPopover';
import { AddDrawer } from '../ui/AddDrawer';
import { BottomNav, MANAGER_TABS, USER_TABS } from './BottomNav';
import { PendingPage } from './PendingPage';
import { OrgOverlayPage } from '../overlays/OrgOverlayPage';
import { AddDeviceOverlayPage } from '../overlays/AddDeviceOverlayPage';
import { AddOrgOverlayPage } from '../overlays/AddOrgOverlayPage';
import { AddVenueOverlayPage } from '../overlays/AddVenueOverlayPage';
import { AddUserOverlayPage } from '../overlays/AddUserOverlayPage';
import { Dashboard } from '../dashboard/Dashboard';
import { OrganizationsPage } from '../pages/OrganizationsPage';
import { VenuesPage } from '../pages/VenuesPage';
import { DevicesPage } from '../pages/DevicesPage';
import { UsersPage } from '../pages/UsersPage';
import { ReportsPage } from '../pages/ReportsPage';
import { DeviceResetModal } from '../overlays/DeviceResetModal';
import {
  ensureWifiPermissions,
  isWifiSetupSupported,
} from '../../services/wifiService';

const logoSource = require('../../../assets/logo.png');
const logoMeta = Image.resolveAssetSource(logoSource);
const LOGO_HEIGHT = 32; // h-8
const LOGO_WIDTH =
  logoMeta?.width && logoMeta?.height
    ? (LOGO_HEIGHT * logoMeta.width) / logoMeta.height
    : 96;

const TAB_TITLES = {
  organizations: 'Organizations',
  venues: 'Venues',
  devices: 'Devices',
  users: 'Users',
  reports: 'Reports',
};

const ADD_FAB_TABS = ['organizations', 'venues', 'devices', 'users'];

const ADD_META = {
  organizations: {
    title: 'New Organization',
    subtitle: 'Add Directory Record',
  },
  venues: { title: 'New Venue', subtitle: 'Add Directory Record' },
  devices: { title: 'Add Device', subtitle: 'SoftAP Setup' },
  users: { title: 'New User', subtitle: 'Add Directory Record' },
};

/**
 * Mobile ConsoleLayout: logo + (Menu only on dashboard) + profile.
 * Orgs / Venues / Devices / Users FAB opens a right-side drawer
 * (react-native-drawer-layout).
 */
export function ConsoleLayout() {
  const insets = useSafeAreaInsets();
  const {
    role,
    logout,
    activeTab,
    setActiveTab,
    selectedOrgId: globalOrgId,
    setSelectedOrgId: setGlobalOrgId,
    selectedVenueId,
    setSelectedVenueId,
    setSelectedUnitId,
    dashboardOrgs: orgs,
    dashboardVenues: venues,
    fetchMyVenues,
    loadDevicesForVenues,
  } = useAppContext();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isOrgPageOpen, setIsOrgPageOpen] = useState(false);
  const [orgOverlayExpandVenueId, setOrgOverlayExpandVenueId] = useState(null);
  const [orgOverlaySession, setOrgOverlaySession] = useState(0);
  /** Which Add form is in the right drawer, or null when closed. */
  const [addKind, setAddKind] = useState(null);

  const tabs = role === 'manager' ? MANAGER_TABS : USER_TABS;

  const closeAddDrawer = useCallback(() => setAddKind(null), []);

  const resetOverlays = useCallback(() => {
    setIsOrgPageOpen(false);
    setAddKind(null);
  }, []);

  const openOrgOverlay = useCallback(
    (expandVenueId) => {
      setAddKind(null);
      setOrgOverlayExpandVenueId(expandVenueId || selectedVenueId || null);
      setOrgOverlaySession((n) => n + 1);
      setIsOrgPageOpen(true);
    },
    [selectedVenueId]
  );

  const consoleValue = useMemo(() => ({ openOrgOverlay }), [openOrgOverlay]);

  useEffect(() => {
    void fetchMyVenues().catch(() => {});
  }, [fetchMyVenues]);

  useEffect(() => {
    if (orgs.length === 0) {
      if (globalOrgId) setGlobalOrgId(null);
      return;
    }
    if (!globalOrgId || !orgs.some((o) => o.id === globalOrgId)) {
      setGlobalOrgId(orgs[0].id);
    }
  }, [orgs, globalOrgId, setGlobalOrgId]);

  const orgVenues = useMemo(
    () => (globalOrgId ? venues.filter((v) => v.orgId === globalOrgId) : venues),
    [venues, globalOrgId]
  );

  useEffect(() => {
    if (!selectedVenueId) return;
    if (!orgVenues.some((v) => v.id === selectedVenueId)) {
      setSelectedVenueId(null);
      setSelectedUnitId(null);
    }
  }, [orgVenues, selectedVenueId, setSelectedVenueId, setSelectedUnitId]);

  useEffect(() => {
    if (!orgVenues.length) return;
    void loadDevicesForVenues(orgVenues.map((v) => v.id)).catch(() => {});
  }, [orgVenues, loadDevicesForVenues]);

  const addOpen = Boolean(addKind);
  const showFab =
    ADD_FAB_TABS.includes(activeTab) && !addOpen && !isOrgPageOpen;

  const presentAddForTab = useCallback(async () => {
    if (!ADD_FAB_TABS.includes(activeTab)) return;
    // Devices SoftAP: finish the OS permission sheet before opening the
    // drawer so the sheet can't blank out Add Device content on first open.
    if (activeTab === 'devices' && isWifiSetupSupported) {
      try {
        await ensureWifiPermissions();
      } catch (_) {
        // Still open — Add Device shows its own Grant UI if needed.
      }
    }
    setAddKind(activeTab);
  }, [activeTab]);

  const handleMenu = () => {
    setOrgOverlayExpandVenueId(selectedVenueId);
    setOrgOverlaySession((n) => n + 1);
    setIsOrgPageOpen((open) => !open);
  };

  const isDashboard = activeTab === 'dashboard';
  const menuSpin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(menuSpin, {
      toValue: isOrgPageOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 120,
    }).start();
  }, [isOrgPageOpen, menuSpin]);

  const menuRotate = menuSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const handleTabPress = (tabId) => {
    resetOverlays();
    setActiveTab(tabId);
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    void logout();
  };

  const renderContent = () => {
    if (isOrgPageOpen) {
      return (
        <OrgOverlayPage
          key={orgOverlaySession}
          expandVenueId={orgOverlayExpandVenueId}
          onClose={() => setIsOrgPageOpen(false)}
        />
      );
    }
    if (activeTab === 'dashboard') return <Dashboard />;
    if (activeTab === 'organizations') return <OrganizationsPage />;
    if (activeTab === 'venues') return <VenuesPage />;
    if (activeTab === 'devices') return <DevicesPage />;
    if (activeTab === 'users') return <UsersPage />;
    if (activeTab === 'reports') return <ReportsPage />;
    return <PendingPage title={TAB_TITLES[activeTab] || 'Page'} />;
  };

  const addMeta = addKind ? ADD_META[addKind] : { title: '', subtitle: '' };

  const addPanel = (() => {
    if (addKind === 'organizations') {
      return <AddOrgOverlayPage embedded onClose={closeAddDrawer} />;
    }
    if (addKind === 'venues') {
      return <AddVenueOverlayPage embedded onClose={closeAddDrawer} />;
    }
    if (addKind === 'devices') {
      return <AddDeviceOverlayPage embedded onClose={closeAddDrawer} />;
    }
    if (addKind === 'users') {
      return <AddUserOverlayPage embedded onClose={closeAddDrawer} />;
    }
    return null;
  })();

  const fabBottom = 84 + insets.bottom + 12;
  const fabPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!showFab) {
      fabPulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(fabPulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showFab, fabPulse]);

  return (
    <ConsoleContext.Provider value={consoleValue}>
      <View className="flex-1 bg-slate-50" style={{ paddingTop: insets.top }}>
        {/* Header — always above the drawer */}
        <View className="relative z-40 h-14 shrink-0 flex-row items-center justify-between bg-transparent px-4">
          <Image
            source={logoSource}
            resizeMode="contain"
            style={{ height: LOGO_HEIGHT, width: LOGO_WIDTH }}
            accessibilityLabel="Ackit"
          />

          <View
            className="flex-row items-center gap-2 rounded-full bg-blue-600 px-2.5 py-2.5"
            style={{
              shadowColor: '#0f172a',
              shadowOpacity: 0.2,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
              elevation: 4,
            }}
          >
            {isDashboard ? (
              <>
                <Pressable
                  onPress={handleMenu}
                  hitSlop={8}
                  className="active:scale-95"
                  accessibilityLabel="Menu"
                >
                  <Animated.View style={{ transform: [{ rotate: menuRotate }] }}>
                    <HugeiconsIcon
                      icon={Menu}
                      size={16}
                      color={isOrgPageOpen ? '#bfdbfe' : '#ffffff'}
                    />
                  </Animated.View>
                </Pressable>
                <View className="h-3.5 w-px bg-white/20" />
              </>
            ) : null}

            <AnchoredPopover
              open={showProfileMenu}
              onClose={() => setShowProfileMenu(false)}
              width={224}
              align="right"
              gap={12}
              panelClassName="rounded-2xl border border-slate-100 bg-white py-2.5 shadow-xl"
              trigger={
                <Pressable
                  onPress={() => setShowProfileMenu(!showProfileMenu)}
                  hitSlop={8}
                  className="active:scale-95"
                  accessibilityLabel="Profile"
                >
                  <HugeiconsIcon icon={User} size={16} color="#ffffff" />
                </Pressable>
              }
            >
              <Pressable
                onPress={handleLogout}
                className="flex-row items-center gap-2 px-4 py-2 active:bg-red-50"
              >
                <HugeiconsIcon icon={LogOut} size={16} color="#dc2626" />
                <Text className="text-xs font-black uppercase tracking-wider text-red-600">
                  Log Out
                </Text>
              </Pressable>
            </AnchoredPopover>
          </View>
        </View>

        {/* Content frame only — drawer overlays this region, not header/nav */}
        <View
          className="min-h-0 flex-1"
          style={{ paddingBottom: 84 + insets.bottom }}
        >
          <AddDrawer
            open={addOpen}
            onClose={closeAddDrawer}
            title={addMeta.title}
            subtitle={addMeta.subtitle}
            scrollable={addKind !== 'devices'}
            panel={addPanel}
          >
            <View className="min-h-0 flex-1">{renderContent()}</View>
          </AddDrawer>
        </View>

        {showFab ? (
          <Animated.View
            pointerEvents="box-none"
            className="absolute z-50"
            style={{
              right: 20,
              bottom: fabBottom,
              transform: [{ scale: fabPulse }],
            }}
          >
            <Pressable
              onPress={presentAddForTab}
              accessibilityLabel="Add"
              className="h-14 w-14 items-center justify-center rounded-full bg-blue-600 active:scale-95"
              style={{
                shadowColor: '#2563eb',
                shadowOpacity: 0.35,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
              }}
            >
              <HugeiconsIcon
                icon={Plus}
                size={24}
                color="#ffffff"
                strokeWidth={2.5}
              />
            </Pressable>
          </Animated.View>
        ) : null}

        <BottomNav
          tabs={tabs}
          activeTab={activeTab}
          onTabPress={handleTabPress}
        />

        <DeviceResetModal />
      </View>
    </ConsoleContext.Provider>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  List,
  Search,
  Wind,
} from '@hugeicons/core-free-icons';
import { useAppContext } from '../../context/AppContext';
import { AnchoredPopover } from '../ui/AnchoredPopover';

const FILTERS = [
  { id: 'all', label: 'All Venues' },
  { id: 'active', label: 'Active Devices' },
  { id: 'faulty', label: 'Faulty Devices' },
];

const cleanName = (name) => String(name || '').replace('_', ' ');

function AcIcon({ color, size = 16 }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M2 12h20" />
      <Path d="M5 16s2 1 7 1 7-1 7-1" />
      <Path d="M8 8H5a3 3 0 0 0-3 3v4" />
      <Path d="M16 8h3a3 3 0 0 1 3 3v4" />
    </Svg>
  );
}

/**
 * Port of web OrgOverlayPage — the mobile venue / device picker opened from
 * the header hamburger (or the "No. of devices" card).
 */
export function OrgOverlayPage({ onClose, expandVenueId = null }) {
  const {
    dashboardOrgs: orgs,
    dashboardVenues: venues,
    dashboardUnits: units,
    selectedUnitId,
    setSelectedUnitId,
    setSelectedVenueId,
    selectedOrgId: globalOrgId,
    setSelectedOrgId: setGlobalOrgId,
    selectedVenueId: globalVenueId,
    setActiveTab,
  } = useAppContext();

  const [selectedOrgId, setSelectedOrgId] = useState(
    globalOrgId || orgs[0]?.id || ''
  );
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [expandedVenueIds, setExpandedVenueIds] = useState({});
  const [openVenueDropdownId, setOpenVenueDropdownId] = useState(null);

  useEffect(() => {
    if (globalOrgId && orgs.some((o) => o.id === globalOrgId)) {
      setSelectedOrgId(globalOrgId);
      return;
    }
    if (
      orgs.length > 0 &&
      (!selectedOrgId || !orgs.some((o) => o.id === selectedOrgId))
    ) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [globalOrgId, orgs, selectedOrgId]);

  const selectedOrg = useMemo(
    () =>
      orgs.find((o) => o.id === selectedOrgId) ||
      orgs[0] || { id: '', name: 'Organization' },
    [orgs, selectedOrgId]
  );

  const orgVenues = useMemo(
    () => venues.filter((v) => v.orgId === selectedOrgId),
    [venues, selectedOrgId]
  );

  const filteredVenues = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return orgVenues.filter((venue) => {
      const venueUnits = units.filter((u) => u.venueId === venue.id);
      const matchesSearch =
        q === '' ||
        venue.name.toLowerCase().includes(q) ||
        venueUnits.some((u) => u.name.toLowerCase().includes(q));

      let matchesFilter = true;
      if (activeFilter === 'active') {
        matchesFilter = venueUnits.some((u) => u.isOn);
      } else if (activeFilter === 'faulty') {
        matchesFilter = venueUnits.some((u) => u.hasFault);
      }
      return matchesSearch && matchesFilter;
    });
  }, [orgVenues, searchQuery, units, activeFilter]);

  const didAutoExpand = useRef(false);
  useEffect(() => {
    if (didAutoExpand.current) return;
    const targetId =
      expandVenueId ||
      globalVenueId ||
      units.find((u) => u.id === selectedUnitId)?.venueId ||
      orgVenues[0]?.id ||
      null;
    if (!targetId) return;
    const match = orgVenues.find((v) => String(v.id) === String(targetId));
    if (!match) return;
    didAutoExpand.current = true;
    setExpandedVenueIds({ [match.id]: true });
  }, [expandVenueId, globalVenueId, selectedUnitId, units, orgVenues]);

  const toggleVenueExpand = (venueId) =>
    setExpandedVenueIds((prev) => ({ ...prev, [venueId]: !prev[venueId] }));

  const handleSelectOrg = (orgId) => {
    setSelectedOrgId(orgId);
    setGlobalOrgId(orgId);
    setIsOrgDropdownOpen(false);
    setSearchQuery('');
  };

  const goToOrgDashboard = () => {
    setGlobalOrgId(selectedOrgId);
    setSelectedVenueId(null);
    setSelectedUnitId(null);
    setActiveTab('dashboard');
    onClose();
  };

  const goToVenueDashboard = (venueId) => {
    setGlobalOrgId(selectedOrgId);
    setSelectedVenueId(venueId);
    setSelectedUnitId(null);
    setActiveTab('dashboard');
    onClose();
  };

  const goToDeviceDashboard = (venueId, unitId) => {
    setGlobalOrgId(selectedOrgId);
    setSelectedVenueId(venueId);
    setSelectedUnitId(unitId);
    setActiveTab('dashboard');
    setOpenVenueDropdownId(null);
    onClose();
  };

  return (
    <View className="flex-1 bg-[#f8fafc] px-5 pb-6 pt-4">
      {/* Title & organization selector */}
      <View className="mb-4">
        <Text className="mb-1 text-xs font-black uppercase tracking-wider text-slate-400">
          Organization List
        </Text>

        <View className="self-start">
          <AnchoredPopover
            open={isOrgDropdownOpen && orgs.length > 1}
            onClose={() => setIsOrgDropdownOpen(false)}
            width={256}
            maxHeight={240}
            panelClassName="rounded-2xl border border-slate-100 bg-white py-2.5 shadow-xl"
            trigger={
              <Pressable
                onPress={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                className="-ml-2 flex-row items-center gap-2 rounded-lg px-2 py-1.5 active:bg-slate-100"
              >
                <Text className="text-2xl font-black leading-none tracking-tight text-slate-900">
                  {cleanName(selectedOrg.name)}
                </Text>
                {orgs.length > 1 ? (
                  <View
                    className="mt-1"
                    style={{
                      transform: [
                        { rotate: isOrgDropdownOpen ? '180deg' : '0deg' },
                      ],
                    }}
                  >
                    <HugeiconsIcon
                      icon={ChevronDown}
                      size={20}
                      color="#64748b"
                    />
                  </View>
                ) : null}
              </Pressable>
            }
          >
            <View className="mb-1 border-b border-slate-100 px-4 py-1.5">
              <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Switch Organization
              </Text>
            </View>
            <ScrollView bounces={false} nestedScrollEnabled>
              {orgs.map((org) => {
                const active = selectedOrgId === org.id;
                return (
                  <Pressable
                    key={org.id}
                    onPress={() => handleSelectOrg(org.id)}
                    className={`flex-row items-center justify-between px-4 py-2.5 ${
                      active ? 'bg-blue-50/50' : 'active:bg-slate-50'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        active ? 'text-blue-600' : 'text-slate-700'
                      }`}
                    >
                      {cleanName(org.name)}
                    </Text>
                    {active ? (
                      <HugeiconsIcon icon={Check} size={16} color="#2563eb" />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </AnchoredPopover>
        </View>
      </View>

      {/* Filter & search row */}
      <View className="mb-4 flex-row items-center gap-3">
        <AnchoredPopover
          open={showFilterDropdown}
          onClose={() => setShowFilterDropdown(false)}
          width={192}
          panelClassName="rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl"
          trigger={
            <Pressable
              onPress={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex-row items-center gap-2 rounded-full bg-blue-600 px-4 py-3 shadow-md active:scale-95 active:bg-blue-700"
            >
              <Text className="text-xs font-black uppercase tracking-wider text-white">
                Filter
              </Text>
              <View className="h-5 w-5 items-center justify-center rounded-full bg-[#10b981]">
                <HugeiconsIcon icon={ChevronDown} size={12} color="#ffffff" />
              </View>
            </Pressable>
          }
        >
          {FILTERS.map((f) => {
            const active = activeFilter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  setActiveFilter(f.id);
                  setShowFilterDropdown(false);
                }}
                className="flex-row items-center justify-between px-4 py-2.5 active:bg-slate-50"
              >
                <Text
                  className={`text-xs font-bold ${
                    active ? 'text-blue-600' : 'text-slate-700'
                  }`}
                >
                  {f.label}
                </Text>
                {active ? (
                  <HugeiconsIcon icon={Check} size={16} color="#2563eb" />
                ) : null}
              </Pressable>
            );
          })}
        </AnchoredPopover>

        <View className="relative flex-1 justify-center">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search"
            placeholderTextColor="#94a3b8"
            className="w-full rounded-full border border-slate-200/50 bg-white py-3 pl-4 pr-10 text-xs font-bold text-slate-800 shadow-sm"
          />
          <View
            pointerEvents="none"
            className="absolute right-4 top-0 bottom-0 justify-center"
          >
            <HugeiconsIcon icon={Search} size={16} color="#3b82f6" />
          </View>
        </View>
      </View>

      {/* Scrollable list of venues & devices */}
      <View className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        {filteredVenues.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <Text className="mb-1 text-sm font-black uppercase tracking-widest text-slate-400">
              No Venues Found
            </Text>
            <Text className="max-w-[200px] text-center text-xs text-slate-400">
              Try adjusting your search query or filter options
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* All Campus Venues */}
            <Pressable
              onPress={goToOrgDashboard}
              className="flex-row items-center gap-4 px-5 py-4 active:bg-slate-100/30"
            >
              <View className="h-7 w-7 items-center justify-center rounded-full border border-blue-100/30 bg-blue-50">
                <HugeiconsIcon
                  icon={Building2}
                  size={14}
                  color="#2563eb"
                  strokeWidth={2.5}
                />
              </View>
              <Text className="text-[13px] font-extrabold uppercase tracking-wider text-[#005ac1]">
                All Campus Venues
              </Text>
            </Pressable>

            {filteredVenues.map((venue) => {
              const venueUnits = units.filter((u) => u.venueId === venue.id);
              const isExpanded = !!expandedVenueIds[venue.id];
              const dropdownOpen = openVenueDropdownId === venue.id;

              return (
                <View key={venue.id} className="border-t border-slate-100">
                  {/* Venue row */}
                  <Pressable
                    onPress={() => goToVenueDashboard(venue.id)}
                    className="flex-row items-center justify-between px-5 py-4 active:bg-slate-100/30"
                  >
                    <View className="min-w-0 flex-1 flex-row items-center gap-4">
                      <Pressable
                        onPress={() => toggleVenueExpand(venue.id)}
                        hitSlop={8}
                        className={`h-7 w-7 items-center justify-center rounded-full ${
                          isExpanded
                            ? 'bg-blue-600'
                            : 'border border-blue-100/30 bg-blue-50'
                        }`}
                      >
                        <HugeiconsIcon
                          icon={isExpanded ? ChevronUp : ChevronDown}
                          size={14}
                          color={isExpanded ? '#ffffff' : '#2563eb'}
                          strokeWidth={3}
                        />
                      </Pressable>
                      <Text
                        numberOfLines={1}
                        className="min-w-0 flex-1 text-[13px] font-bold uppercase tracking-wider text-[#005ac1]"
                      >
                        {cleanName(venue.name)}
                      </Text>
                    </View>

                    {/* Device picker dropdown */}
                    <AnchoredPopover
                      open={dropdownOpen}
                      onClose={() => setOpenVenueDropdownId(null)}
                      width={256}
                      align="right"
                      maxHeight={224}
                      panelClassName="rounded-2xl border border-slate-100/80 bg-white py-2 shadow-xl"
                      trigger={
                        <Pressable
                          onPress={() =>
                            setOpenVenueDropdownId(dropdownOpen ? null : venue.id)
                          }
                          className={`h-8 w-8 items-center justify-center rounded-full active:scale-90 ${
                            dropdownOpen ? 'bg-blue-100' : 'bg-slate-50'
                          }`}
                        >
                          <HugeiconsIcon
                            icon={List}
                            size={16}
                            color={dropdownOpen ? '#2563eb' : '#94a3b8'}
                          />
                        </Pressable>
                      }
                    >
                      <View className="mb-1.5 border-b border-slate-100 px-4 py-1.5">
                        <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {cleanName(venue.name)} Devices
                        </Text>
                      </View>
                      <ScrollView bounces={false} nestedScrollEnabled>
                        {venueUnits.length === 0 ? (
                          <Text className="px-4 py-3 text-xs italic text-slate-400">
                            No devices in this venue
                          </Text>
                        ) : (
                          venueUnits.map((unit) => {
                            const selected = selectedUnitId === unit.id;
                            return (
                              <Pressable
                                key={unit.id}
                                onPress={() =>
                                  goToDeviceDashboard(venue.id, unit.id)
                                }
                                className={`flex-row items-center justify-between px-4 py-2.5 ${
                                  selected ? 'bg-blue-50/50' : 'active:bg-slate-50'
                                }`}
                              >
                                <View className="min-w-0 flex-1 flex-row items-center gap-2">
                                  <HugeiconsIcon
                                    icon={Wind}
                                    size={14}
                                    color={unit.isOn ? '#10b981' : '#cbd5e1'}
                                  />
                                  <Text
                                    numberOfLines={1}
                                    className={`min-w-0 flex-1 text-xs font-bold ${
                                      selected ? 'text-blue-600' : 'text-slate-700'
                                    }`}
                                  >
                                    {unit.name}
                                  </Text>
                                </View>
                                <View className="flex-row items-center gap-1.5">
                                  <View
                                    className={`rounded px-1.5 py-0.5 ${
                                      unit.isOn ? 'bg-emerald-50' : 'bg-slate-100'
                                    }`}
                                  >
                                    <Text
                                      className={`text-[9px] font-black ${
                                        unit.isOn
                                          ? 'text-emerald-600'
                                          : 'text-slate-500'
                                      }`}
                                    >
                                      {unit.isOn ? 'ON' : 'OFF'}
                                    </Text>
                                  </View>
                                  {selected ? (
                                    <HugeiconsIcon
                                      icon={Check}
                                      size={14}
                                      color="#2563eb"
                                    />
                                  ) : null}
                                </View>
                              </Pressable>
                            );
                          })
                        )}
                      </ScrollView>
                    </AnchoredPopover>
                  </Pressable>

                  {/* Inline expanded devices */}
                  {isExpanded ? (
                    <View className="bg-[#fcfdfe] py-1 pl-14 pr-5">
                      {venueUnits.length === 0 ? (
                        <Text className="py-3 text-xs italic text-slate-400">
                          No devices configured
                        </Text>
                      ) : (
                        venueUnits.map((unit, idx) => {
                          const selected = selectedUnitId === unit.id;
                          return (
                            <Pressable
                              key={unit.id}
                              onPress={() =>
                                goToDeviceDashboard(venue.id, unit.id)
                              }
                              className={`flex-row items-center justify-between py-3 active:opacity-70 ${
                                idx > 0 ? 'border-t border-slate-100/50' : ''
                              }`}
                            >
                              <View className="min-w-0 flex-1 flex-row items-center gap-3">
                                <View
                                  className={`h-8 w-8 items-center justify-center rounded-lg ${
                                    unit.isOn ? 'bg-blue-50' : 'bg-slate-50'
                                  }`}
                                >
                                  <View
                                    style={{
                                      transform: [
                                        { rotate: unit.isOn ? '12deg' : '0deg' },
                                      ],
                                    }}
                                  >
                                    <AcIcon
                                      color={unit.isOn ? '#005ac1' : '#94a3b8'}
                                    />
                                  </View>
                                </View>
                                <Text
                                  numberOfLines={1}
                                  className={`min-w-0 flex-1 text-[13px] font-bold tracking-wide ${
                                    selected ? 'text-[#005ac1]' : 'text-slate-600'
                                  }`}
                                >
                                  {unit.name}
                                </Text>
                              </View>
                              <View className="flex-row items-center gap-2">
                                <View
                                  className={`rounded px-2 py-0.5 ${
                                    unit.isOn ? 'bg-emerald-100' : 'bg-slate-100'
                                  }`}
                                >
                                  <Text
                                    className={`text-[9px] font-black ${
                                      unit.isOn
                                        ? 'text-emerald-800'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {unit.isOn ? 'ON' : 'OFF'}
                                  </Text>
                                </View>
                                {selected ? (
                                  <View className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                                ) : null}
                              </View>
                            </Pressable>
                          );
                        })
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

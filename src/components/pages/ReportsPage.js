import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Activity01Icon,
  Building2,
  Cpu,
  Download01Icon,
  Flash,
  MapPin,
} from '@hugeicons/core-free-icons';
import { useAppContext } from '../../context/AppContext';
import { getDevicesByVenue } from '../../api/deviceApi';
import { getDeviceEnergy } from '../../api/energyApi';
import { Select } from '../ui/Select';
import { Toast, useToast } from '../ui/Toast';

const PERIOD_TABS = [
  { id: 'hourly', label: 'Hour' },
  { id: 'daily', label: 'Day' },
  { id: 'weekly', label: 'Week' },
  { id: 'monthly', label: 'Month' },
  { id: 'yearly', label: 'Year' },
];

function escapeCsv(value) {
  const raw = String(value ?? '');
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Mobile Energy Reports — mirrors web Reports:
 * org + venue filters, period tabs, Device/Units/Power table, CSV share.
 */
export function ReportsPage() {
  const {
    dashboardOrgs: orgs,
    dashboardVenues: venues,
    venuesLoading,
    fetchMyVenues,
    role,
  } = useAppContext();
  const { toast, showToast } = useToast();

  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [periodView, setPeriodView] = useState('daily');

  const [deviceIds, setDeviceIds] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [devicesError, setDevicesError] = useState(null);

  const [deviceRows, setDeviceRows] = useState([]);
  const [monthTotalKwh, setMonthTotalKwh] = useState(0);
  const [dailyAverageKwh, setDailyAverageKwh] = useState(0);
  const [loadingEnergy, setLoadingEnergy] = useState(false);
  const [energyError, setEnergyError] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (role === 'user') return;
    void fetchMyVenues().catch(() => {});
  }, [fetchMyVenues, role]);

  useEffect(() => {
    if (!orgs.length) return;
    setSelectedOrgId((prev) =>
      prev && orgs.some((o) => o.id === prev) ? prev : orgs[0].id
    );
  }, [orgs]);

  const orgVenues = useMemo(
    () => venues.filter((v) => v.orgId === selectedOrgId),
    [venues, selectedOrgId]
  );

  useEffect(() => {
    if (!selectedOrgId) return;
    if (!orgVenues.length) {
      if (!venuesLoading) setSelectedVenueId('');
      return;
    }
    setSelectedVenueId((prev) =>
      prev && orgVenues.some((v) => v.id === prev) ? prev : orgVenues[0].id
    );
  }, [orgVenues, selectedOrgId, venuesLoading]);

  const orgOptions = useMemo(
    () =>
      orgs.length > 0
        ? orgs.map((o) => ({ value: o.id, label: o.name }))
        : [
            {
              value: '',
              label: venuesLoading ? 'Loading…' : 'No organizations',
              disabled: true,
            },
          ],
    [orgs, venuesLoading]
  );

  const venueOptions = useMemo(
    () =>
      orgVenues.length > 0
        ? orgVenues.map((v) => ({ value: v.id, label: v.name }))
        : [
            {
              value: '',
              label: venuesLoading
                ? 'Loading…'
                : selectedOrgId
                  ? 'No venues'
                  : 'Select org first',
              disabled: true,
            },
          ],
    [orgVenues, venuesLoading, selectedOrgId]
  );

  const selectedOrgName = useMemo(
    () => orgs.find((o) => o.id === selectedOrgId)?.name || 'Organization',
    [orgs, selectedOrgId]
  );

  const selectedVenueName = useMemo(
    () => orgVenues.find((v) => v.id === selectedVenueId)?.name || 'Venue',
    [orgVenues, selectedVenueId]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadVenueDeviceIds() {
      if (!selectedVenueId) {
        setDeviceIds([]);
        setDevicesError(null);
        setLoadingDevices(false);
        return;
      }

      setLoadingDevices(true);
      setDevicesError(null);
      try {
        const list = await getDevicesByVenue(selectedVenueId);
        if (cancelled) return;
        setDeviceIds(list.map((d) => d.id).filter(Boolean));
      } catch {
        if (cancelled) return;
        setDeviceIds([]);
        setDevicesError('Could not load devices for this venue');
      } finally {
        if (!cancelled) setLoadingDevices(false);
      }
    }

    void loadVenueDeviceIds();
    return () => {
      cancelled = true;
    };
  }, [selectedVenueId]);

  const deviceIdsKey = deviceIds.join(',');

  useEffect(() => {
    let cancelled = false;
    const ids = deviceIdsKey ? deviceIdsKey.split(',') : [];

    async function loadEnergy() {
      if (ids.length === 0) {
        setDeviceRows([]);
        setEnergyError(null);
        setLoadingEnergy(false);
        return;
      }

      setLoadingEnergy(true);
      setEnergyError(null);
      try {
        const res = await getDeviceEnergy(ids, periodView);
        if (cancelled) return;
        setDeviceRows(Array.isArray(res.devices) ? res.devices : []);
      } catch {
        if (cancelled) return;
        setEnergyError('Could not load consumption data');
        setDeviceRows([]);
      } finally {
        if (!cancelled) setLoadingEnergy(false);
      }
    }

    void loadEnergy();
    return () => {
      cancelled = true;
    };
  }, [deviceIdsKey, periodView]);

  useEffect(() => {
    let cancelled = false;
    const ids = deviceIdsKey ? deviceIdsKey.split(',') : [];

    async function loadMonthStats() {
      if (ids.length === 0) {
        setMonthTotalKwh(0);
        setDailyAverageKwh(0);
        return;
      }

      try {
        const res = await getDeviceEnergy(ids, 'monthly');
        if (cancelled) return;
        const total = Number(res.totalKwh) || 0;
        const days = Math.max(1, res.series?.length || 30);
        setMonthTotalKwh(total);
        setDailyAverageKwh(total / days);
      } catch {
        if (cancelled) return;
        setMonthTotalKwh(0);
        setDailyAverageKwh(0);
      }
    }

    void loadMonthStats();
    return () => {
      cancelled = true;
    };
  }, [deviceIdsKey]);

  const periodTotalKwh = useMemo(
    () => deviceRows.reduce((sum, r) => sum + (Number(r.unitsKwh) || 0), 0),
    [deviceRows]
  );

  const handleDownload = useCallback(async () => {
    if (exporting) return;
    if (loadingEnergy) {
      showToast('Energy data is still loading…');
      return;
    }
    if (deviceRows.length === 0) {
      showToast('No consumption data to export');
      return;
    }

    const headers = [
      'Device',
      'Organization',
      'Venue',
      'Units (kWh)',
      'Power (W)',
    ];

    const lines = [
      headers.map(escapeCsv).join(','),
      ...deviceRows.map((row) =>
        [
          row.deviceName,
          row.organizationName || selectedOrgName,
          row.venueName || selectedVenueName,
          Number(row.unitsKwh || 0).toFixed(4),
          Number(row.powerW || 0).toFixed(2),
        ]
          .map(escapeCsv)
          .join(',')
      ),
      [
        'TOTAL',
        selectedOrgName,
        selectedVenueName,
        periodTotalKwh.toFixed(4),
        '',
      ]
        .map(escapeCsv)
        .join(','),
    ];

    // BOM so Excel opens UTF-8 correctly
    const csvContent = `\uFEFF${lines.join('\r\n')}`;
    const safeOrg = selectedOrgName.replace(/[^\w\-]+/g, '_');
    const safeVenue = selectedVenueName.replace(/[^\w\-]+/g, '_');
    const date = new Date().toISOString().split('T')[0];
    const filename = `energy_${safeOrg}_${safeVenue}_${periodView}_${date}.csv`;

    setExporting(true);
    try {
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!dir) {
        throw new Error('No writable directory');
      }
      const fileUri = `${dir}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Download energy report',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        const result = await Share.share(
          Platform.OS === 'ios'
            ? { url: fileUri, title: filename }
            : { message: csvContent, title: filename }
        );
        if (result.action === Share.dismissedAction) return;
      }
    } catch (err) {
      const msg = String(err?.message || '');
      if (/User did not share|canceled|cancelled/i.test(msg)) return;
      showToast(msg || 'Could not share CSV');
    } finally {
      setExporting(false);
    }
  }, [
    exporting,
    loadingEnergy,
    deviceRows,
    selectedOrgName,
    selectedVenueName,
    periodView,
    periodTotalKwh,
    showToast,
  ]);

  const canDownload = !loadingEnergy && !exporting && deviceRows.length > 0;
  const showTable = !loadingDevices && deviceIds.length > 0;

  const displayRows =
    deviceRows.length > 0
      ? deviceRows
      : deviceIds.map((id) => ({
          deviceId: id,
          deviceName: '…',
          unitsKwh: 0,
          powerW: 0,
        }));

  return (
    <View className="min-h-0 flex-1 px-4 pb-2 pt-1">
      <View className="mb-3 flex-row items-start justify-between gap-3 px-1">
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <HugeiconsIcon icon={Activity01Icon} size={20} color="#2563eb" />
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 text-lg font-black tracking-tight text-slate-900"
            >
              Energy Reports
            </Text>
          </View>
          <Text className="mt-0.5 text-[11px] font-semibold text-slate-500">
            Detailed energy consumption analysis
          </Text>
        </View>
        <Pressable
          onPress={handleDownload}
          disabled={exporting}
          className={`flex-row items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 active:scale-95 ${
            exporting || !canDownload ? 'opacity-60' : ''
          }`}
          accessibilityLabel="Download CSV"
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <HugeiconsIcon icon={Download01Icon} size={14} color="#ffffff" />
          )}
          <Text className="text-[10px] font-black uppercase tracking-wider text-white">
            {exporting ? '…' : 'CSV'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        className="min-h-0 flex-1"
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-3 rounded-2xl border border-slate-100 bg-white p-3">
          <View className="flex-row gap-3">
            <View className="min-w-0 flex-1">
              <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Organization
              </Text>
              <Select
                value={selectedOrgId}
                onChange={(v) => {
                  setSelectedOrgId(v);
                  setSelectedVenueId('');
                }}
                options={orgOptions}
                icon={Building2}
                variant="compact"
                visibleCount={4}
              />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Venue
              </Text>
              <Select
                value={selectedVenueId}
                onChange={setSelectedVenueId}
                options={venueOptions}
                icon={MapPin}
                variant="compact"
                visibleCount={4}
              />
            </View>
          </View>
        </View>

        <View className="mb-3 flex-row gap-3">
          <View className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-white p-3">
            <View className="mb-2 flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
                <HugeiconsIcon icon={Flash} size={16} color="#2563eb" />
              </View>
              <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Month Total
              </Text>
            </View>
            <Text className="text-2xl font-black tabular-nums tracking-tight text-slate-900">
              {monthTotalKwh.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
              <Text className="text-sm font-bold text-slate-400"> kWh</Text>
            </Text>
          </View>
          <View className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-white p-3">
            <View className="mb-2 flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
                <HugeiconsIcon icon={Activity01Icon} size={16} color="#059669" />
              </View>
              <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Daily Avg
              </Text>
            </View>
            <Text className="text-2xl font-black tabular-nums tracking-tight text-slate-900">
              {dailyAverageKwh.toFixed(1)}
              <Text className="text-sm font-bold text-slate-400"> kWh</Text>
            </Text>
          </View>
        </View>

        <View className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <View className="gap-2 border-b border-slate-100 px-3 pb-2 pt-3">
            <View className="min-w-0">
              <Text className="text-sm font-black tracking-tight text-slate-900">
                Consumption
              </Text>
              <Text className="mt-0.5 text-[10px] font-semibold text-slate-400">
                {deviceIds.length} device{deviceIds.length === 1 ? '' : 's'}
                {loadingDevices || loadingEnergy ? ' · Loading…' : ''}
                {!loadingEnergy && deviceRows.length > 0
                  ? ` · ${periodTotalKwh.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })} kWh`
                  : ''}
                {devicesError ? ` · ${devicesError}` : ''}
                {energyError ? ` · ${energyError}` : ''}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 4 }}
            >
              <View className="flex-row gap-0.5 rounded-xl bg-slate-100 p-1">
                {PERIOD_TABS.map((tab) => {
                  const active = periodView === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      onPress={() => setPeriodView(tab.id)}
                      className={`rounded-lg px-2.5 py-1.5 ${
                        active ? 'bg-white' : ''
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          active ? 'text-blue-600' : 'text-slate-500'
                        }`}
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {loadingDevices ? (
            <View className="items-center justify-center gap-2 py-16">
              <ActivityIndicator color="#2563eb" />
              <Text className="text-xs font-semibold text-slate-400">
                Loading devices…
              </Text>
            </View>
          ) : !selectedOrgId || !selectedVenueId ? (
            <View className="items-center justify-center px-8 py-16">
              <HugeiconsIcon icon={Building2} size={40} color="#cbd5e1" />
              <Text className="mt-3 text-center text-sm font-black uppercase tracking-widest text-slate-400">
                Select Filters
              </Text>
              <Text className="mt-1 max-w-[220px] text-center text-xs font-semibold text-slate-400">
                Choose an organization and venue to view device consumption.
              </Text>
            </View>
          ) : devicesError ? (
            <View className="items-center justify-center px-8 py-16">
              <HugeiconsIcon icon={Activity01Icon} size={40} color="#fcd34d" />
              <Text className="mt-3 text-center text-sm font-black uppercase tracking-widest text-slate-500">
                {devicesError}
              </Text>
            </View>
          ) : deviceIds.length === 0 ? (
            <View className="items-center justify-center px-8 py-16">
              <HugeiconsIcon icon={Cpu} size={40} color="#cbd5e1" />
              <Text className="mt-3 text-center text-sm font-black uppercase tracking-widest text-slate-400">
                No Devices Found
              </Text>
              <Text className="mt-1 max-w-[220px] text-center text-xs font-semibold text-slate-400">
                No devices registered for this venue yet.
              </Text>
            </View>
          ) : showTable ? (
            <>
              <View className="flex-row items-center border-b border-slate-100 bg-slate-50/95 px-4 py-3">
                <Text className="w-[48%] text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Device
                </Text>
                <Text className="w-[26%] text-right text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Units
                </Text>
                <Text className="w-[26%] text-right text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Power
                </Text>
              </View>
              {displayRows.map((row) => (
                <View
                  key={row.deviceId}
                  className="flex-row items-center border-b border-slate-50 px-4 py-3"
                >
                  <View className="w-[48%] flex-row items-center gap-2 pr-1">
                    <View className="h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                      <HugeiconsIcon icon={Cpu} size={14} color="#2563eb" />
                    </View>
                    <Text
                      numberOfLines={1}
                      className="min-w-0 flex-1 text-[11px] font-extrabold text-slate-900"
                    >
                      {row.deviceName}
                    </Text>
                  </View>
                  <View className="w-[26%] items-end">
                    {loadingEnergy ? (
                      <Text className="text-[11px] font-black text-slate-400">
                        …
                      </Text>
                    ) : (
                      <Text className="text-[11px] font-black tabular-nums text-slate-900">
                        {Number(row.unitsKwh).toLocaleString(undefined, {
                          maximumFractionDigits: 3,
                        })}{' '}
                        <Text className="text-[9px] font-bold uppercase text-slate-400">
                          kWh
                        </Text>
                      </Text>
                    )}
                  </View>
                  <View className="w-[26%] items-end">
                    {loadingEnergy ? (
                      <Text className="text-[11px] font-black text-slate-400">
                        …
                      </Text>
                    ) : (
                      <Text className="text-[11px] font-black tabular-nums text-slate-900">
                        {Number(row.powerW).toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}{' '}
                        <Text className="text-[9px] font-bold uppercase text-slate-400">
                          W
                        </Text>
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </View>
      </ScrollView>

      <View pointerEvents="none" className="absolute left-4 right-4 top-1 z-50">
        <Toast toast={toast} />
      </View>
    </View>
  );
}

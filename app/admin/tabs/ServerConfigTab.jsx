"use client";
// @ts-nocheck
// ServerConfigTab.jsx — drop into /app/admin/tabs/
// Orchestrates all 7 server config sub-components.
// Each sub-tab is accessed directly from AdminPanel's sidebar nav
// via the initialTab prop — no internal sidebar needed.

import { useState, useEffect, useCallback } from "react";
import { fetchApi, ADMINS } from "./shared";

import ModsMapTab         from "./ModsMapTab";
import ServerSettingsTab  from "./ServerSettingsTab";
import WorldLootTab       from "./WorldLootTab";
import ZombiesTab         from "./ZombiesTab";
import SkillsXPTab        from "./SkillsXPTab";
import VehiclesAnimalsTab from "./VehiclesAnimalsTab";
import ActivityLogTab     from "./ActivityLogTab";

const TAB_MAP = {
  mods:     ModsMapTab,
  server:   ServerSettingsTab,
  world:    WorldLootTab,
  zombies:  ZombiesTab,
  skills:   SkillsXPTab,
  vehicles: VehiclesAnimalsTab,
  log:      ActivityLogTab,
};

export default function ServerConfigTab({ toast, initialTab = "mods" }) {
  const ActiveTab = TAB_MAP[initialTab] || ModsMapTab;
  return <ActiveTab toast={toast} />;
}

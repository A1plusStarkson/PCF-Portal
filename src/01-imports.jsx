import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard, FileText, Wallet, Receipt, Database, Plus, Download,
  Check, X, Search, AlertTriangle, TrendingUp, Users, Building2, Trash2,
  Edit3, ChevronRight, ChevronLeft, Banknote, ClipboardList, PiggyBank, CircleDollarSign,
  ArrowUpRight, ArrowDownRight, FileSpreadsheet, RefreshCw, Filter as FilterIcon,
  Printer, Bell, History, ShieldCheck, ArrowLeftRight, Clock, UserCog, Landmark, LogOut,
  Settings, KeyRound, FolderOpen, Upload, UploadCloud, Star, Archive, ArchiveRestore,
  Eye, File as FileIcon, Paperclip, ClipboardCheck, House, Megaphone, CalendarClock, ZoomIn, ZoomOut, Mail, Lock, EyeOff, CircleCheck,
  Sun, Moon, Monitor, Move, ExternalLink, Maximize2
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

/* ---- Excel library (xlsx), loaded in the background ----
   It is only needed when someone exports, but a static import made every
   page load wait for it — and its CDN sends max-age=0, so even a returning
   visit paid a round trip. It now starts downloading once the portal is
   already on screen. Every use of XLSX is inside an export handler, so the
   calls stay synchronous; in the rare case an export is clicked within the
   first seconds, the user is told to try again instead of getting nothing. */
let XLSX_MODULE = null;
import("xlsx").then((m) => { XLSX_MODULE = m; }).catch((e) => console.warn("Excel library failed to load:", e));
const XLSX = new Proxy({}, {
  get(_, key) {
    if (!XLSX_MODULE) {
      window.alert("The Excel export tool is still loading. Please try again in a few seconds.");
      throw new Error("xlsx not loaded yet");
    }
    return XLSX_MODULE[key];
  },
});


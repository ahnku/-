import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  GripVertical,
  Settings,
  Sun,
  Moon,
  Download,
  Upload,
  X,
  Phone,
  User,
  Save,
  LogOut,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { AuthProvider, useAuth } from "./useAuth";
import LoginScreen from "./LoginScreen";

function todayKey() {
  const d = new Date();
  const y =

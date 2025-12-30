import { Router } from "express";
import {
  getEvents,
  getEventByCode,
  getDistinctStates,
  getDistinctCities,
  getDistinctTimeControls,
  getStats,
} from "../db/database.js";
import type { EventFilters } from "../types/event.js";

const router = Router();

router.get("/", (req, res) => {
  try {
    const filters: EventFilters = {
      state: req.query.state as string | undefined,
      city: req.query.city as string | undefined,
      timeControlType: req.query.timeControlType as string | undefined,
      startDateFrom: req.query.startDateFrom as string | undefined,
      startDateTo: req.query.startDateTo as string | undefined,
      search: req.query.search as string | undefined,
      status: req.query.status as EventFilters["status"] | undefined,
    };

    const events = getEvents(filters);
    res.json({ success: true, data: events, count: events.length });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ success: false, error: "Failed to fetch events" });
  }
});

router.get("/stats", (_req, res) => {
  try {
    const stats = getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

router.get("/filters", (_req, res) => {
  try {
    const states = getDistinctStates();
    const cities = getDistinctCities();
    const timeControls = getDistinctTimeControls();
    res.json({
      success: true,
      data: { states, cities, timeControls },
    });
  } catch (error) {
    console.error("Error fetching filters:", error);
    res.status(500).json({ success: false, error: "Failed to fetch filters" });
  }
});

router.get("/:eventCode", (req, res) => {
  try {
    const event = getEventByCode(req.params.eventCode);
    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }
    res.json({ success: true, data: event });
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ success: false, error: "Failed to fetch event" });
  }
});

export default router;

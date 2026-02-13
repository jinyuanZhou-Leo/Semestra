import React from 'react';
import {
  EVENT_BUS_DEFAULT_DEBOUNCE_MS,
  EVENT_BUS_DEFAULT_DEDUPE_WINDOW_MS,
} from './constants';
import type {
  PublishEventOptions,
  TimetableEventPayloadMap,
  TimetableEventType,
} from './types';

type EventHandler<T extends TimetableEventType> = (payload: TimetableEventPayloadMap[T]) => void;

class TimetableEventBus {
  private listeners = new Map<TimetableEventType, Set<EventHandler<any>>>();
  private pendingDebounce = new Map<TimetableEventType, ReturnType<typeof setTimeout>>();
  private pendingPayload = new Map<TimetableEventType, TimetableEventPayloadMap[TimetableEventType]>();
  private recentPublishes = new Map<string, number>();

  publish<T extends TimetableEventType>(
    type: T,
    payload: TimetableEventPayloadMap[T],
    options?: PublishEventOptions,
  ) {
    const dedupeWindowMs = options?.dedupeWindowMs ?? EVENT_BUS_DEFAULT_DEDUPE_WINDOW_MS;
    const dedupeKey = options?.dedupeKey ?? JSON.stringify(payload);
    const dedupeToken = `${type}:${dedupeKey}`;
    const now = Date.now();
    const previousPublishedAt = this.recentPublishes.get(dedupeToken);

    if (typeof previousPublishedAt === 'number' && (now - previousPublishedAt) < dedupeWindowMs) {
      return;
    }

    this.recentPublishes.set(dedupeToken, now);
    this.pendingPayload.set(type, payload);

    const pendingTimeout = this.pendingDebounce.get(type);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
    }

    const debounceMs = options?.debounceMs ?? EVENT_BUS_DEFAULT_DEBOUNCE_MS;
    const timeoutId = setTimeout(() => {
      this.pendingDebounce.delete(type);
      const pendingPayload = this.pendingPayload.get(type);
      this.pendingPayload.delete(type);
      if (!pendingPayload) return;

      const handlers = this.listeners.get(type);
      if (!handlers || handlers.size === 0) return;

      for (const handler of handlers) {
        try {
          handler(pendingPayload);
        } catch (error) {
          console.error(`TimetableEventBus handler failed for ${type}`, error);
        }
      }
    }, Math.max(0, debounceMs));

    this.pendingDebounce.set(type, timeoutId);
  }

  subscribe<T extends TimetableEventType>(type: T, handler: EventHandler<T>) {
    const handlers = this.listeners.get(type) ?? new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);

    return () => {
      const registeredHandlers = this.listeners.get(type);
      if (!registeredHandlers) return;
      registeredHandlers.delete(handler);
      if (registeredHandlers.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  clear() {
    for (const timeout of this.pendingDebounce.values()) {
      clearTimeout(timeout);
    }
    this.listeners.clear();
    this.pendingDebounce.clear();
    this.pendingPayload.clear();
    this.recentPublishes.clear();
  }
}

export const timetableEventBus = new TimetableEventBus();

export const useEventBus = <T extends TimetableEventType>(
  type: T,
  handler: EventHandler<T>,
) => {
  const handlerRef = React.useRef(handler);

  React.useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  React.useEffect(() => {
    const unsubscribe = timetableEventBus.subscribe(type, (payload) => {
      handlerRef.current(payload);
    });

    return unsubscribe;
  }, [type]);
};

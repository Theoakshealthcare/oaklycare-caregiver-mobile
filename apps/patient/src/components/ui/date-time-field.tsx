import type React from "react";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";
import { formatSlot, isPastDay, isPastSlot, isoDate, monthName, monthWeeks, timeOptions } from "@/src/domain/slots";

import Button from "./button";
import ChipSelect from "./chip-select";
import FieldLabel from "./field-label";
import Icon from "./icon";
import Text from "./text";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const TIMES = timeOptions();

interface Props {
  label: string;
  required?: boolean;
  /** "YYYY-MM-DD" and "HH:MM", or "" for none yet. */
  date: string;
  time: string;
  onChange: (next: { date: string; time: string }) => void;
  placeholder?: string;
  error?: string;
}

/**
 * The calendar field of Figma ("March 20th 10:00 am", calendar icon). Tapping opens a sheet with a month grid (days before today
 * cannot be chosen), a row of start times (today's earlier ones cannot be chosen) and Done. Drawn with plain views, so it needs no
 * native date picker module. The choice is kept inside the sheet until Done.
 */
const DateTimeField: React.FC<Props> = ({ label, required, date, time, onChange, placeholder = "Select a date and time", error }) => {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [shown, setShown] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [pick, setPick] = useState({ date, time });

  const show = () => {
    const base = date ? new Date(`${date}T00:00:00`) : new Date();
    setShown({ year: base.getFullYear(), month: base.getMonth() });
    setPick({ date, time });
    setOpen(true);
  };

  const atCurrentMonth = shown.year === today.getFullYear() && shown.month === today.getMonth();
  const step = (by: number) => {
    const d = new Date(shown.year, shown.month + by, 1);
    setShown({ year: d.getFullYear(), month: d.getMonth() });
  };

  const choose = (day: number) => {
    const next = isoDate(new Date(shown.year, shown.month, day));
    // A time that has already passed today is dropped when today is chosen.
    setPick((prev) => ({ date: next, time: prev.time && isPastSlot(next, prev.time) ? "" : prev.time }));
  };

  const pastTimes = pick.date ? TIMES.filter((t) => isPastSlot(pick.date, t.value)).map((t) => t.value) : TIMES.map((t) => t.value);
  const ready = pick.date !== "" && pick.time !== "";
  const text = date && time ? formatSlot(date, time) : placeholder;

  return (
    <View>
      <FieldLabel required={required}>{label}</FieldLabel>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text }}
        onPress={show}
        style={[styles.field, { borderColor: error ? theme.colors.secondary : theme.colors.primary }]}
      >
        <Text color={date && time ? theme.colors.text : theme.colors.textLight} style={styles.fieldText}>
          {text}
        </Text>
        <Icon name="calendar-outline" size={20} />
      </Pressable>
      {error ? (
        <Text variant="small" color={theme.colors.secondary} style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text weight="bold" style={styles.fieldText}>
              {label}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={() => setOpen(false)}>
              <Icon name="close" size={22} />
            </Pressable>
          </View>
          <View style={styles.body}>
            <View style={styles.monthRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                accessibilityState={{ disabled: atCurrentMonth }}
                disabled={atCurrentMonth}
                hitSlop={8}
                onPress={() => step(-1)}
              >
                <Icon name="chevron-back" size={22} color={atCurrentMonth ? theme.colors.border : theme.colors.text} />
              </Pressable>
              <Text weight="bold">{`${monthName(shown.month)} ${shown.year}`}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={8} onPress={() => step(1)}>
                <Icon name="chevron-forward" size={22} />
              </Pressable>
            </View>
            <View style={styles.week}>
              {WEEKDAYS.map((d, i) => (
                <Text key={`${d}${i}`} variant="small" color={theme.colors.textLight} center style={styles.cell}>
                  {d}
                </Text>
              ))}
            </View>
            {monthWeeks(shown.year, shown.month).map((week, w) => (
              <View key={w} style={styles.week}>
                {week.map((day, i) => {
                  if (day === null) return <View key={i} style={styles.cell} />;
                  const disabled = isPastDay(shown.year, shown.month, day);
                  const selected = pick.date === isoDate(new Date(shown.year, shown.month, day));
                  return (
                    <Pressable
                      key={i}
                      accessibilityRole="button"
                      accessibilityLabel={`${monthName(shown.month)} ${day}`}
                      accessibilityState={{ disabled, selected }}
                      disabled={disabled}
                      onPress={() => choose(day)}
                      style={styles.cell}
                    >
                      <View style={[styles.day, selected && styles.daySelected]}>
                        <Text variant="small" weight={selected ? "bold" : "regular"} color={selected ? theme.colors.white : disabled ? theme.colors.border : theme.colors.text}>
                          {String(day)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <ChipSelect label="Start time" options={TIMES} value={pick.time} onChange={(v) => setPick((prev) => ({ ...prev, time: v }))} disabledValues={pastTimes} />
            <Button
              title="Done"
              disabled={!ready}
              onPress={() => {
                onChange(pick);
                setOpen(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  fieldText: { flex: 1 },
  error: { marginTop: theme.spacing.xs },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: theme.colors.white, borderTopLeftRadius: theme.borderRadius.xxl, borderTopRightRadius: theme.borderRadius.xxl, paddingBottom: theme.spacing.lg },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  body: { padding: theme.spacing.md, gap: theme.spacing.sm },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  week: { flexDirection: "row" },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 40 },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: theme.colors.primary },
});

export default DateTimeField;

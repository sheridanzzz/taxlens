import { View } from "react-native";
import { wfhPlanningEstimate } from "@shared/tax-time";
import { formatCurrency } from "@shared/tax-calculator";
import { useData } from "@/lib/store";
import { colors } from "@/lib/theme";
import { Card, T } from "@/components/ui";

export const WfhEstimate = () => {
  const { data } = useData();
  const estimate = wfhPlanningEstimate(data.settings);
  if (!estimate) return null;
  return (
    <Card tint={colors.lav}>
      <T w="heavy" size={19} color={colors.plum} accessibilityRole="header">WFH planning estimate · FY {data.settings.financialYear}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
        <View><T size={13} color={colors.plum}>Estimated hours</T><T w="black" size={26} color={colors.plum}>{estimate.hours.toLocaleString("en-AU")} h</T></View>
        <View><T size={13} color={colors.plum}>At 70c/hour</T><T w="black" size={26} color={colors.plum}>{formatCurrency(estimate.deduction)}</T></View>
      </View>
      <T size={13} color={colors.inkSoft}>{estimate.homeDaysPerFortnight} home days per fortnight × {estimate.hoursPerDay} hours/day × {estimate.weeks} weeks. Before leave, public holidays, schedule changes and FY boundary adjustments.</T>
      <T w="bold" size={13} color={colors.plum}>Based on your usual pattern; no timesheet. This estimate is excluded from saved claims and tax exports.</T>
    </Card>
  );
};

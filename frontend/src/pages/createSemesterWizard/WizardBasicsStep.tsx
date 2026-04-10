import React from "react";

import { FieldSet } from "@/components/ui/field";
import { SemesterBasicsFields } from "../../components/SemesterBasicsFields";
import type { BasicsDraft } from "./types";

interface WizardBasicsStepProps {
  value: BasicsDraft;
  onChange: (value: BasicsDraft) => void;
}

export const WizardBasicsStep: React.FC<WizardBasicsStepProps> = ({ value, onChange }) => (
  <FieldSet>
    <SemesterBasicsFields
      value={value}
      onChange={onChange}
      showRequiredIndicators
    />
  </FieldSet>
);

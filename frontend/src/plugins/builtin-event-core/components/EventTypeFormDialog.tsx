"use no memo";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export interface CourseEventType {
  id: string;
  code: string;
  abbreviation: string;
  track_attendance: boolean;
  color?: string | null;
  icon?: string | null;
}

interface EventTypeFormData {
  code: string;
  abbreviation: string;
  track_attendance: boolean;
}

interface FieldError {
  field: keyof EventTypeFormData;
  message: string;
}

interface EventTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  confirmLabel?: string;
  initialData?: CourseEventType | null;
  onSubmit: (data: EventTypeFormData) => Promise<void>;
  /**
   * Optional error handler to extract field-specific errors from backend response
   * Returns an array of field errors, or null to fall back to generic toast
   */
  parseError?: (error: any) => FieldError[] | null;
  description?: string;
}



const deriveAbbreviationFromCode = (code: string): string => {
  if (!code) return '';
  const cleaned = code.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
};

/**
 * Default error parser for EVENT_TYPE_DUPLICATE errors
 */
const defaultErrorParser = (error: any): FieldError[] | null => {
  const errorDetail = error?.response?.data?.detail;
  if (errorDetail?.code === 'EVENT_TYPE_DUPLICATE') {
    const message = errorDetail?.message || '';
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('code') && !lowerMessage.includes('abbreviation')) {
      return [{ field: 'code', message: 'This type name already exists for this course.' }];
    } else if (lowerMessage.includes('abbreviation')) {
      return [{ field: 'abbreviation', message: 'This abbreviation already exists for this course.' }];
    } else {
      // Generic duplicate - could be either
      return [{ field: 'code', message: 'Type name or abbreviation already exists.' }];
    }
  }
  return null;
};

export const EventTypeFormDialog: React.FC<EventTypeFormDialogProps> = ({
  open,
  onOpenChange,
  title,
  confirmLabel,
  initialData,
  onSubmit,
  parseError = defaultErrorParser,
  description,
}) => {
  const [formData, setFormData] = React.useState<EventTypeFormData>({
    code: '',
    abbreviation: '',
    track_attendance: false,
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof EventTypeFormData, string>>>({});

  React.useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          code: initialData.code,
          abbreviation: initialData.abbreviation,
          track_attendance: initialData.track_attendance,
        });
      } else {
        setFormData({ code: '', abbreviation: '', track_attendance: false });
      }
      setErrors({});
    }
  }, [open, initialData]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setErrors({});
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      
      // Try to parse field-specific errors
      const fieldErrors = parseError(err);
      
      if (fieldErrors && fieldErrors.length > 0) {
        // Convert array of field errors to error state object
        const errorMap: Partial<Record<keyof EventTypeFormData, string>> = {};
        fieldErrors.forEach(({ field, message }) => {
          errorMap[field] = message;
        });
        setErrors(errorMap);
      } else {
        // Fall back to generic toast for other errors
        const errorDetail = err?.response?.data?.detail;
        toast.error(errorDetail?.message || err?.message || 'Failed to save event type.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (field: keyof EventTypeFormData, value: any) => {
    // Clear error for this field when user starts typing
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
    
    if (field === 'code') {
      const val = value as string;
      setFormData((prev) => {
        const derived = deriveAbbreviationFromCode(val);
        const shouldAutofill = !prev.abbreviation || prev.abbreviation === deriveAbbreviationFromCode(prev.code);
        return {
          ...prev,
          code: val,
          abbreviation: shouldAutofill ? derived : prev.abbreviation,
        };
      });
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title || (initialData ? 'Edit Event Type' : 'Create Event Type')}</DialogTitle>
          <DialogDescription>
            {description || (initialData ? 'Update the details of this event type.' : 'Define a new event type for your course sections.')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 pt-4 pb-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="et-form-code" className={errors.code ? 'text-destructive' : ''}>
                Type Name
              </Label>
              <Input
                id="et-form-code"
                placeholder="e.g. Workshop"
                value={formData.code}
                className={errors.code ? 'border-destructive focus-visible:ring-destructive' : ''}
                onChange={(e) => handleFieldChange('code', e.target.value)}
              />
              {errors.code && <p className="text-sm text-destructive">{errors.code}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-form-abbr" className={errors.abbreviation ? 'text-destructive' : ''}>
                Abbreviation
              </Label>
              <Input
                id="et-form-abbr"
                placeholder="WS"
                value={formData.abbreviation}
                className={errors.abbreviation ? 'border-destructive focus-visible:ring-destructive' : ''}
                onChange={(e) => handleFieldChange('abbreviation', e.target.value.toUpperCase())}
              />
              {errors.abbreviation && <p className="text-sm text-destructive">{errors.abbreviation}</p>}
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-2 select-none">
            <Switch
              id="et-form-track"
              checked={formData.track_attendance}
              onCheckedChange={(checked: boolean) => handleFieldChange('track_attendance', checked)}
            />
            <Label htmlFor="et-form-track" className="text-sm font-medium leading-none cursor-pointer">
              Track attendance <span className="text-muted-foreground font-normal ml-1">(forces `skip=false`)</span>
            </Label>
          </div>

        </div>



        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!formData.code || !formData.abbreviation || isLoading}
          >
            {confirmLabel || (initialData ? 'Save Changes' : 'Create Type')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

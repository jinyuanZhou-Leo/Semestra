import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const TodoTab: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Todo</CardTitle>
        <CardDescription>
          Todo integration is reserved for later phases.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">This placeholder keeps the target plugin structure stable.</p>
      </CardContent>
    </Card>
  );
};

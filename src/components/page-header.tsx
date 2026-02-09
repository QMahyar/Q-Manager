import { useNavigate } from "react-router-dom";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  backTo?: string;
}

export function PageHeader({ title, description, children, backTo = "/" }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="border-b border-border/70 bg-background/80 backdrop-blur px-6 py-4 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(backTo)} className="hover:bg-primary/10">
            <IconArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}

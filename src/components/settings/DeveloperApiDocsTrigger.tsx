import { useNavigate } from "react-router-dom";
import { Book } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DeveloperApiDocsTrigger() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Book className="h-5 w-5" />
          Documentación API
        </CardTitle>
        <CardDescription>
          Guía completa para integrar NotyFive con otras plataformas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => navigate("/developers/api")}>
          Ver documentación
        </Button>
      </CardContent>
    </Card>
  );
}

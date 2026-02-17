import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Patient, Operation, Implant, Radio, Visite, SurgeryImplantWithDetails, OperationWithImplants } from "@shared/schema";

interface SurgeryImplantWithVisites extends SurgeryImplantWithDetails {
  visites?: Visite[];
}

interface PatientWithDetails extends Patient {
  operations: OperationWithImplants[];
  surgeryImplants: SurgeryImplantWithVisites[];
  radios: Radio[];
}

export default function PatientReportPage() {
  const [, params] = useRoute("/patients/:id/report");
  const patientId = params?.id;

  const { data: patient, isLoading } = useQuery<PatientWithDetails>({
    queryKey: ["/api/patients", patientId],
    enabled: !!patientId,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const calculateAge = (dateNaissance: string) => {
    const birthDate = new Date(dateNaissance);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getInterventionLabel = (type: string | string[]) => {
    const labels: Record<string, string> = {
      POSE_IMPLANT: "Pose d'implant",
      GREFFE_OSSEUSE: "Greffe osseuse",
      SINUS_LIFT: "Sinus lift",
      EXTRACTION_IMPLANT_IMMEDIATE: "Extraction + Implant immédiat",
      REPRISE_IMPLANT: "Implantoplastie",
      CHIRURGIE_GUIDEE: "Chirurgie guidée",
      POSE_PROTHESE: "Pose de prothèse",
      DEPOSE_IMPLANT: "Dépose d'implant",
      DEPOSE_PROTHESE: "Dépose de prothèse",
    };
    if (Array.isArray(type)) {
      return type.map(t => labels[t] || t).join(" + ");
    }
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      EN_SUIVI: "En suivi",
      SUCCES: "Succès",
      COMPLICATION: "Complication",
      ECHEC: "Échec",
    };
    return labels[status] || status;
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6">
        <p>Patient non trouvé</p>
        <Link href="/patients">
          <Button variant="outline">Retour</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 print:hidden flex items-center justify-between border-b bg-background sticky top-0 z-10">
        <Link href={`/patients/${patientId}`}>
          <Button variant="ghost" size="sm" data-testid="button-back-from-report">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
        <Button onClick={handlePrint} data-testid="button-print-report">
          <Printer className="h-4 w-4 mr-2" />
          Imprimer
        </Button>
      </div>

      <div className="p-8 max-w-4xl mx-auto print:p-4 print:max-w-none">
        <style>{`
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print\\:hidden { display: none !important; }
            @page { margin: 1cm; size: A4; }
          }
        `}</style>

        <header className="mb-8 border-b pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">Rapport Clinique</h1>
              <p className="text-muted-foreground">Dossier implantologique</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Date d'édition: {formatDate(new Date().toISOString())}</p>
              <p className="font-mono text-xs">Ref: {patientId?.slice(0, 8)}</p>
            </div>
          </div>
        </header>

        <section className="mb-8">
          <h2 className="text-lg font-semibold border-b pb-2 mb-4">Informations Patient</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Nom complet:</span>
              <p className="font-medium">{patient.prenom} {patient.nom}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Date de naissance:</span>
              <p className="font-medium">{formatDate(patient.dateNaissance)} ({calculateAge(patient.dateNaissance)} ans)</p>
            </div>
            <div>
              <span className="text-muted-foreground">Sexe:</span>
              <p className="font-medium">{patient.sexe === "HOMME" ? "Homme" : "Femme"}</p>
            </div>
            {patient.telephone && (
              <div>
                <span className="text-muted-foreground">Téléphone:</span>
                <p className="font-medium">{patient.telephone}</p>
              </div>
            )}
            {patient.email && (
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{patient.email}</p>
              </div>
            )}
          </div>
          {patient.contexteMedical && (
            <div className="mt-4">
              <span className="text-muted-foreground text-sm">Contexte médical:</span>
              <p className="mt-1 p-3 bg-muted/50 rounded text-sm">{patient.contexteMedical}</p>
            </div>
          )}
        </section>

        {patient.operations && patient.operations.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold border-b pb-2 mb-4">Historique Chirurgical</h2>
            <div className="space-y-4">
              {patient.operations.map((op) => (
                <div key={op.id} className="border rounded p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">{getInterventionLabel(op.typeIntervention)}</h3>
                      <p className="text-sm text-muted-foreground">{formatDate(op.dateOperation)}</p>
                    </div>
                    <span className="text-sm bg-muted px-2 py-1 rounded">{op.surgeryImplants?.length || 0} implant(s)</span>
                  </div>
                  {op.notesPerop && (
                    <div className="mt-2 text-sm">
                      <span className="text-muted-foreground">Notes per-opératoires:</span>
                      <p className="mt-1">{op.notesPerop}</p>
                    </div>
                  )}
                  {op.observationsPostop && (
                    <div className="mt-2 text-sm">
                      <span className="text-muted-foreground">Observations post-opératoires:</span>
                      <p className="mt-1">{op.observationsPostop}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {patient.surgeryImplants && patient.surgeryImplants.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold border-b pb-2 mb-4">Implants ({patient.surgeryImplants.length})</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Site</th>
                  <th className="text-left py-2 px-2">Marque</th>
                  <th className="text-left py-2 px-2">Dimensions</th>
                  <th className="text-left py-2 px-2">Type Os</th>
                  <th className="text-left py-2 px-2">ISQ Pose</th>
                  <th className="text-left py-2 px-2">ISQ 3M</th>
                  <th className="text-left py-2 px-2">ISQ 6M</th>
                  <th className="text-left py-2 px-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {patient.surgeryImplants.map((surgeryImplant) => (
                  <tr key={surgeryImplant.id} className="border-b">
                    <td className="py-2 px-2 font-mono">{surgeryImplant.siteFdi}</td>
                    <td className="py-2 px-2">{surgeryImplant.implant.marque}</td>
                    <td className="py-2 px-2 font-mono">{surgeryImplant.implant.diametre}x{surgeryImplant.implant.longueur}mm</td>
                    <td className="py-2 px-2 font-mono">{surgeryImplant.typeOs || "-"}</td>
                    <td className="py-2 px-2 font-mono">{surgeryImplant.isqPose || "-"}</td>
                    <td className="py-2 px-2 font-mono">{surgeryImplant.isq3m || "-"}</td>
                    <td className="py-2 px-2 font-mono">{surgeryImplant.isq6m || "-"}</td>
                    <td className="py-2 px-2">{getStatusLabel(surgeryImplant.statut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 space-y-4">
              {patient.surgeryImplants.map((surgeryImplant) => (
                surgeryImplant.visites && surgeryImplant.visites.length > 0 && (
                  <div key={`visits-${surgeryImplant.id}`} className="border rounded p-4">
                    <h4 className="font-medium mb-2">Visites de contrôle - Site {surgeryImplant.siteFdi}</h4>
                    <div className="space-y-2">
                      {surgeryImplant.visites.map((visite) => (
                        <div key={visite.id} className="flex justify-between text-sm border-b pb-2">
                          <span>{formatDate(visite.date)}</span>
                          <span className="font-mono">{visite.isq ? `ISQ: ${visite.isq}` : "-"}</span>
                          <span className="text-muted-foreground max-w-xs truncate">{visite.notes || "-"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          </section>
        )}

        {patient.radios && patient.radios.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold border-b pb-2 mb-4">Radiographies ({patient.radios.length})</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-left py-2 px-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {patient.radios.map((radio) => (
                  <tr key={radio.id} className="border-b">
                    <td className="py-2 px-2">{formatDate(radio.date)}</td>
                    <td className="py-2 px-2">{radio.type.replace("_", " ")}</td>
                    <td className="py-2 px-2 text-muted-foreground">-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-12 pt-4 border-t text-center text-xs text-muted-foreground">
          <p>Document généré par Cassius - Plateforme de gestion implantologique</p>
          <p>Ce document est confidentiel et destiné uniquement au praticien traitant.</p>
        </footer>
      </div>
    </>
  );
}

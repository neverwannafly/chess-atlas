import {
  Calendar,
  MapPin,
  Clock,
  Trophy,
  Users,
  IndianRupee,
  ExternalLink,
  Building,
  FileText,
  Phone,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDateRange, getEventStatus, getGoogleMapsUrl } from "@/lib/utils";
import { parseContact, parsePrizeBreakdown, type ContactInfo, type PrizeBreakdown } from "@/lib/parseJson";
import { cn } from "@/lib/utils";
import type { ChessEvent } from "@/types/event";

interface EventDetailProps {
  event: ChessEvent | null;
  open: boolean;
  onClose: () => void;
}

export function EventDetail({ event, open, onClose }: EventDetailProps) {
  if (!event) return null;

  const status = getEventStatus(event.startDate, event.endDate);
  const mapsUrl = getGoogleMapsUrl(event.venueMapQuery || `${event.city}, ${event.state}, India`);

  const formatLabel = [
    event.timeControlType,
    event.rounds ? `${event.rounds} rounds` : null,
    event.timeControlDetails,
  ].filter(Boolean).join(" · ");

  const contactData = parseContact(event.contact);
  const prizeData = parsePrizeBreakdown(event.prizeBreakdown);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <StatusBadge status={status} />
            <div className="flex-1 min-w-0">
              <DialogTitle>{event.name}</DialogTitle>
              <DialogDescription>
                Event Code: #{event.eventCode}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="grid lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x">
            {/* Left: Info */}
            <div className="lg:col-span-2 p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <InfoBlock
                  icon={Calendar}
                  label="Dates"
                  value={formatDateRange(event.startDate, event.endDate)}
                />
                <InfoBlock
                  icon={MapPin}
                  label="Location"
                  value={[event.city, event.state].filter(Boolean).join(", ") || "TBA"}
                  href={mapsUrl}
                />
                {event.totalPrize && (
                  <InfoBlock
                    icon={Trophy}
                    label="Total Prize"
                    value={event.totalPrize}
                    highlight
                  />
                )}
                {event.entryFee && (
                  <InfoBlock
                    icon={IndianRupee}
                    label="Entry Fee"
                    value={event.entryFee}
                  />
                )}
                {formatLabel && (
                  <InfoBlock
                    icon={Clock}
                    label="Format"
                    value={formatLabel}
                  />
                )}
                {event.rounds && (
                  <InfoBlock
                    icon={Users}
                    label="Rounds"
                    value={`${event.rounds} rounds`}
                  />
                )}
              </div>

              {/* Summary */}
              {event.summary && (
                <Section title="About">
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {event.summary}
                  </p>
                </Section>
              )}

              {/* Venue */}
              {(event.venueDetails || event.venueAddress) && (
                <Section title="Venue" icon={Building}>
                  {event.venueDetails && (
                    <p className="font-medium text-sm">{event.venueDetails}</p>
                  )}
                  {event.venueAddress && (
                    <p className="text-sm text-muted-foreground mt-1">{event.venueAddress}</p>
                  )}
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Open in Google Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </Section>
              )}

              {/* Categories */}
              {(event.ratingCategories || event.ageCategories) && (
                <Section title="Categories">
                  {event.ratingCategories && (
                    <div className="text-sm mb-2">
                      <span className="font-medium text-foreground">Rating: </span>
                      <span className="text-muted-foreground">{event.ratingCategories}</span>
                    </div>
                  )}
                  {event.ageCategories && (
                    <div className="text-sm">
                      <span className="font-medium text-foreground">Age: </span>
                      <span className="text-muted-foreground">{event.ageCategories}</span>
                    </div>
                  )}
                </Section>
              )}

              {/* Prize Breakdown */}
              {prizeData && (
                <Section title="Prize Distribution" icon={Trophy}>
                  {typeof prizeData === "string" ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {prizeData}
                    </p>
                  ) : (
                    <PrizeTable data={prizeData} />
                  )}
                </Section>
              )}

              {/* Contact */}
              {(event.organizer || contactData) && (
                <Section title="Contact" icon={Phone}>
                  {event.organizer && (
                    <p className="text-sm mb-2">
                      <span className="font-medium">Organizer: </span>
                      {event.organizer}
                    </p>
                  )}
                  {event.arbiter && (
                    <p className="text-sm mb-2">
                      <span className="font-medium">Chief Arbiter: </span>
                      {event.arbiter}
                    </p>
                  )}
                  {contactData && (
                    typeof contactData === "string" ? (
                      <p className="text-sm text-muted-foreground">{contactData}</p>
                    ) : (
                      <ContactDisplay data={contactData} />
                    )
                  )}
                </Section>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {event.registrationLink && (
                  <Button asChild size="sm">
                    <a href={event.registrationLink} target="_blank" rel="noopener noreferrer">
                      Register Now
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                {event.brochureUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={event.brochureUrl} target="_blank" rel="noopener noreferrer">
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      Download PDF
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Right: PDF Preview */}
            <div className="lg:col-span-3 bg-muted/30 flex flex-col">
              {event.brochureUrl ? (
                <>
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 shrink-0">
                    <span className="text-xs font-medium text-muted-foreground">Brochure</span>
                    <a
                      href={event.brochureUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Open in new tab
                    </a>
                  </div>
                  <iframe
                    src={`${event.brochureUrl}#toolbar=0&navpanes=0`}
                    className="flex-1 w-full min-h-[500px]"
                    title="Tournament Brochure"
                  />
                </>
              ) : (
                <div className="flex-1 min-h-[400px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileText className="mx-auto h-10 w-10 opacity-30 mb-2" />
                    <p className="text-sm">No brochure available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function PrizeTable({ data }: { data: PrizeBreakdown }) {
  const categories = Object.keys(data);
  
  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <div key={category}>
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
            {category}
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(data[category]).map(([position, prize]) => (
              <div key={position} className="flex justify-between">
                <span className="text-muted-foreground">{position}</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{prize}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactDisplay({ data }: { data: ContactInfo }) {
  return (
    <div className="space-y-2 text-sm">
      {data.phone && data.phone.length > 0 && (
        <div className="flex items-start gap-2">
          <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {data.phone.map((num, i) => (
              <a key={i} href={`tel:${num}`} className="text-primary hover:underline">
                {num}
              </a>
            ))}
          </div>
        </div>
      )}
      {data.email && (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <a href={`mailto:${data.email}`} className="text-primary hover:underline">
            {data.email}
          </a>
        </div>
      )}
      {data.whatsapp && (
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          <a
            href={`https://wa.me/${data.whatsapp.replace(/[^0-9]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {data.whatsapp}
          </a>
        </div>
      )}
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
  href,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string | null;
  highlight?: boolean;
}) {
  const content = (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={cn(
        "text-sm font-medium truncate",
        highlight && "text-emerald-600 dark:text-emerald-400"
      )}>
        {value}
      </p>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80 transition-opacity">
        {content}
      </a>
    );
  }

  return content;
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: "upcoming" | "ongoing" | "past" }) {
  const config = {
    upcoming: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", label: "Upcoming" },
    ongoing: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", label: "Live" },
    past: { bg: "bg-muted", text: "text-muted-foreground", label: "Completed" },
  };

  const c = config[status];

  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", c.bg, c.text)}>
      {c.label}
    </span>
  );
}

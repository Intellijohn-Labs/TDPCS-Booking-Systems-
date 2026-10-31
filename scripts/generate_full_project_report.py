import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas for dynamic page count ('Page X of Y')
    with crisp monochrome running headers and footers.
    """
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#333333"))

        # Top Running Header (Pages > 1)
        if self._pageNumber > 1:
            self.setStrokeColor(colors.HexColor("#222222"))
            self.setLineWidth(0.75)
            self.line(38, 804, 557, 804)
            self.drawString(38, 809, "TDPCS-APT APPOINTMENT & QUEUE MANAGEMENT SYSTEM")
            self.drawRightString(557, 809, "END-TO-END WORKING ARCHITECTURE REPORT")

        # Bottom Running Footer (All pages)
        self.setStrokeColor(colors.HexColor("#222222"))
        self.setLineWidth(0.75)
        self.line(38, 42, 557, 42)
        
        self.drawString(38, 30, "CONFIDENTIAL | Thrissur District Police Co-operative Society Ltd. (TDPCS)")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(557, 30, page_str)
        self.restoreState()

def build_pdf(filename="TDPCS_Full_Project_Working_Report.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=38,
        rightMargin=38,
        topMargin=46,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#000000"),
        spaceAfter=2
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#444444"),
        spaceAfter=10
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#000000"),
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    subsection_heading = ParagraphStyle(
        'SubSectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#222222"),
        spaceBefore=6,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#222222"),
        spaceAfter=4
    )

    body_bold = ParagraphStyle(
        'DocBodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor("#111111")
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#111111")
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=table_cell_style,
        fontName='Helvetica-Bold'
    )

    table_cell_mono = ParagraphStyle(
        'TableCellMono',
        parent=table_cell_style,
        fontName='Courier',
        fontSize=7,
        leading=9
    )

    story = []

    # ---------------------------------------------------------
    # HEADER / TOP BANNER
    # ---------------------------------------------------------
    header_data = [
        [
            Paragraph("<b>TDPCS-APT APPOINTMENT & QUEUE SYSTEM</b><br/><font size='7' color='#555555'>COMPLETE SYSTEM ARCHITECTURE & OPERATIONAL REPORT</font>", body_style),
            Paragraph("<b>DOCUMENT:</b> TDPCS-SYS-ARCH-2026<br/><b>DATE:</b> October 2026<br/><b>SYSTEM STATUS:</b> <font color='#000000'><b>100% OPERATIONAL & LIVE</b></font>", ParagraphStyle('HRight', parent=body_style, alignment=2, fontSize=7.5, leading=10.5))
        ]
    ]
    header_table = Table(header_data, colWidths=[255, 264])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 1.25, colors.black),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))

    # Title & Subtitle
    story.append(Paragraph("SYSTEM ARCHITECTURE & OPERATIONAL REPORT", title_style))
    story.append(Paragraph("Comprehensive Guide on Complete System Functionality: n8n Workflow, Google Sheet PEN Verification, WhatsApp Gateway, Next.js Web App, VPS Hosting, Supabase Cloud & Multi-Layer Security", subtitle_style))

    # Metadata Card
    meta_data = [
        [Paragraph("<b>Target Entity:</b>", body_style), Paragraph("Thrissur District Police Co-op Society Ltd.", body_style),
         Paragraph("<b>Web Subdomain:</b>", body_style), Paragraph("<code>http://apt.tdpcs.in</code> (Port 3015)", body_style)],
        [Paragraph("<b>Automation Host:</b>", body_style), Paragraph("n8n (<code>n8n.srv1691210.hstgr.cloud</code>)", body_style),
         Paragraph("<b>Member Directory:</b>", body_style), Paragraph("Google Sheets (PEN Number Registry)", body_style)],
        [Paragraph("<b>Core Framework:</b>", body_style), Paragraph("Next.js 14.2 (App Router) + React 18", body_style),
         Paragraph("<b>Database & Auth:</b>", body_style), Paragraph("Supabase PostgreSQL (AWS Mumbai)", body_style)],
        [Paragraph("<b>Server & Proxy:</b>", body_style), Paragraph("Ubuntu VPS + PM2 + Nginx (SSL)", body_style),
         Paragraph("<b>Messaging Gateway:</b>", body_style), Paragraph("WhatsApp Business API (WAAU / HTTP)", body_style)]
    ]
    meta_table = Table(meta_data, colWidths=[90, 165, 105, 159])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F6F6F6")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#333333")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E0E0E0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # ---------------------------------------------------------
    # 1. EXECUTIVE SUMMARY
    # ---------------------------------------------------------
    story.append(Paragraph("1. EXECUTIVE SUMMARY & SYSTEM OVERVIEW", section_heading))
    story.append(Paragraph(
        "The <b>TDPCS-Apt Appointment & Queue Management Platform</b> is an automated digital ecosystem developed exclusively for the members and staff of the <b>Thrissur District Police Co-operative Society Ltd. (TDPCS)</b>. The application completely eliminates physical counter overcrowding, manual paper tokens, and phone queue bottlenecks by allowing police department personnel to reserve official counter visit slots through an automated, verified WhatsApp workflow.",
        body_style
    ))
    story.append(Paragraph(
        "The system has been designed with an enterprise-grade, multi-tiered architecture that operates synchronously across seven key technical pillars:",
        body_style
    ))

    arch_summary_data = [
        [Paragraph("Pillar / Layer", table_header_style), Paragraph("Component & Technical Role", table_header_style), Paragraph("Key Benefit to Society Members & Staff", table_header_style)],
        [
            Paragraph("<b>1. WhatsApp Gateway</b>", table_cell_bold),
            Paragraph("Official Society WhatsApp Number (WAAU / HTTP API)", table_cell_style),
            Paragraph("Zero app installation; members interact via familiar WhatsApp chat.", table_cell_style)
        ],
        [
            Paragraph("<b>2. n8n Automation Engine</b>", table_cell_bold),
            Paragraph("Cloud Workflow Server (<code>https://n8n.srv1691210.hstgr.cloud</code>)", table_cell_style),
            Paragraph("Automates message parsing, webhook routing, alerts, and nightly crons.", table_cell_style)
        ],
        [
            Paragraph("<b>3. Google Sheets (PEN Lookup)</b>", table_cell_bold),
            Paragraph("TDPCS Master Member & Police Employee Number (PEN) Directory", table_cell_style),
            Paragraph("Instant verification of police officers; easily maintained by office staff.", table_cell_style)
        ],
        [
            Paragraph("<b>4. Next.js 14 Web Application</b>", table_cell_bold),
            Paragraph("Mobile Booking Wizard (<code>/b/[token]</code>) & Staff Terminal (<code>/app/*</code>)", table_cell_style),
            Paragraph("Fast, touch-optimized booking pass and real-time dual-counter queue cockpit.", table_cell_style)
        ],
        [
            Paragraph("<b>5. Subdomain & SSL Proxy</b>", table_cell_bold),
            Paragraph("<code>apt.tdpcs.in</code> routed via Nginx with Let's Encrypt SSL", table_cell_style),
            Paragraph("Secure, branded HTTPS web access on dedicated sub-network.", table_cell_style)
        ],
        [
            Paragraph("<b>6. Cloud Linux VPS (Port 3015)</b>", table_cell_bold),
            Paragraph("Ubuntu Server supervised by PM2 Cluster Daemon", table_cell_style),
            Paragraph("24/7 uptime, automated restart on reboot, low server resource overhead.", table_cell_style)
        ],
        [
            Paragraph("<b>7. Supabase Cloud PostgreSQL</b>", table_cell_bold),
            Paragraph("AWS Mumbai PostgreSQL Pooler with Row Level Security (RLS)", table_cell_style),
            Paragraph("Atomic anti-collision slot locking, strict extensions, and automated 4M retention.", table_cell_style)
        ]
    ]
    arch_summary_table = Table(arch_summary_data, colWidths=[120, 195, 204])
    arch_summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#000000")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#333333")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9F9F9")]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(arch_summary_table)

    # PAGE 1 END -> PAGE 2
    story.append(PageBreak())

    # ---------------------------------------------------------
    # 2. FULL WORKING STRUCTURE (END-TO-END JOURNEY)
    # ---------------------------------------------------------
    story.append(Paragraph("2. END-TO-END OPERATIONAL WORKFLOW (MEMBER & STAFF JOURNEY)", section_heading))
    story.append(Paragraph(
        "The following five sequential stages detail how an appointment moves from initial WhatsApp message to completed counter service:",
        body_style
    ))

    flow_data = [
        [Paragraph("Stage", table_header_style), Paragraph("Component", table_header_style), Paragraph("Operational Workflow & Client-Understandable Flow", table_header_style)],
        
        [
            Paragraph("<b>Stage 1:<br/>WhatsApp Request & PEN Check</b>", table_cell_bold),
            Paragraph("WhatsApp API<br/>+ n8n Engine<br/>+ Google Sheets", table_cell_style),
            Paragraph("1. Member sends a WhatsApp message (e.g. <i>'Hi'</i> or their <b>PEN Number</b>) to the society's official number.<br/>"
                      "2. The message arrives at the <b>n8n Automation Webhook</b>.<br/>"
                      "3. <b>Google Sheet Verification:</b> n8n queries the official <b>TDPCS Member Master Directory (Google Sheet)</b> to verify the sender's mobile and PEN (Police Employee Number).<br/>"
                      "4. <b>Instant Validation:</b> If verified, n8n calls Supabase to create a single-use 128-bit cryptographic booking token (`booking_links`).<br/>"
                      "5. n8n sends a personalized reply on WhatsApp: <i>'Hello Officer [Name], click here to book your counter slot: https://apt.tdpcs.in/b/[token]'</i> (valid for 2 hours).<br/>"
                      "6. <i>If PEN/Member not found:</i> n8n sends an immediate message requesting the officer to verify their PEN with the society office.", table_cell_style)
        ],
        [
            Paragraph("<b>Stage 2:<br/>Customer Booking Portal</b>", table_cell_bold),
            Paragraph("Next.js App<br/><code>/b/[token]</code><br/>(Subdomain)", table_cell_style),
            Paragraph("1. Member clicks the link; it opens cleanly in any mobile browser or inside WhatsApp.<br/>"
                      "2. <b>Step 1 (Services):</b> Member selects required loan schemes / services (e.g., Short Term Loan, Emergency Loan, Deposit). Total duration is dynamically calculated.<br/>"
                      "3. <b>Step 2 (Date):</b> Interactive calendar shows only active working dates (e.g. Mon/Tue/Wed presets or Saturday morning). Closed days and holidays are locked.<br/>"
                      "4. <b>Step 3 (Slot Time):</b> Member picks an available counter time (Morning: 10:10 AM - 12:30 PM, Afternoon: 2:00 PM - 5:00 PM). Enforces a <b>30-minute advance cutoff</b> to prevent last-minute collisions.<br/>"
                      "5. <b>Step 4 (Pass):</b> Digital Appointment Pass is issued instantly with Token #, Counter, Date, Reporting Time, and QR code.", table_cell_style)
        ],
        [
            Paragraph("<b>Stage 3:<br/>Confirmation & Alerts</b>", table_cell_bold),
            Paragraph("Supabase Trigger<br/>+ n8n Webhook<br/>+ WhatsApp", table_cell_style),
            Paragraph("1. Upon booking completion, PostgreSQL trigger `trg_notify_n8n` automatically notifies n8n via webhook.<br/>"
                      "2. n8n immediately delivers an official WhatsApp confirmation message with token details, counter assignment, reporting time (10 min early), and mandatory <b>Surety Signature Notice</b>.<br/>"
                      "3. An automated reminder is scheduled 15 minutes prior to the member's arrival time.", table_cell_style)
        ],
        [
            Paragraph("<b>Stage 4:<br/>Physical Arrival & Queue Operations</b>", table_cell_bold),
            Paragraph("Staff Terminal<br/><code>/app/queue</code><br/>(Counter Desk)", table_cell_style),
            Paragraph("1. Member arrives at TDPCS office and presents their Token Pass.<br/>"
                      "2. Staff terminal displays live dual-counter queue cockpit (Counter 1 and Counter 2).<br/>"
                      "3. <b>Lifecycle Flow:</b> Staff marks <b>'Arrived'</b> -> clicks <b>'Call'</b> (audible chime rings + visual banner displays) -> clicks <b>'Served'</b> when finished.<br/>"
                      "4. <b>Strict Collision-Free Extension:</b> If counter processing needs more time, staff can extend by +5, +10, +15, or +30 mins <i>strictly</i> when no upcoming booking exists on that counter and it does not cross lunch break (12:30 PM) or closing. Overlaps are strictly disabled.", table_cell_style)
        ],
        [
            Paragraph("<b>Stage 5:<br/>Automated Maintenance & Purge</b>", table_cell_bold),
            Paragraph("n8n Scheduled<br/>Cron (02:00 IST)<br/>+ Supabase", table_cell_style),
            Paragraph("1. <b>Daily Calendar Auto-Generation:</b> n8n triggers `auto_generate_open_days` nightly, maintaining a continuous 60-90 day forward booking window based on admin working day rules.<br/>"
                      "2. <b>Daily 4-Month Privacy Purge:</b> Past appointments older than 120 days are permanently purged to comply with Kerala Police cooperative privacy standards.<br/>"
                      "3. <b>Audit Log Archival:</b> All administrative actions remain logged in `audit_log`.", table_cell_style)
        ]
    ]

    flow_table = Table(flow_data, colWidths=[110, 85, 324])
    flow_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#000000")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#333333")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9F9F9")]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(flow_table)
    story.append(Spacer(1, 8))

    story.append(PageBreak())

    # ---------------------------------------------------------
    # 3. TOOLS & TECHNOLOGIES USED
    # ---------------------------------------------------------
    story.append(Paragraph("3. TOOLS, TECHNOLOGIES & INFRASTRUCTURE", section_heading))
    story.append(Paragraph(
        "Each technology in the TDPCS stack was carefully selected to maximize uptime, speed, security, and low maintenance overhead:",
        body_style
    ))

    tools_data = [
        [Paragraph("Tool / Technology", table_header_style), Paragraph("Component Role", table_header_style), Paragraph("Technical Specification & Why Chosen", table_header_style)],
        
        [
            Paragraph("<b>n8n Automation Engine</b>", table_cell_bold),
            Paragraph("Workflow Orchestrator & Integration Bus", table_cell_style),
            Paragraph("• Hosted on dedicated cloud instance: <code>https://n8n.srv1691210.hstgr.cloud</code>.<br/>"
                      "• Manages bidirectional webhook communication between WhatsApp, Google Sheets, and Supabase.<br/>"
                      "• Executes scheduled nightly crons (02:00 AM IST) for calendar auto-generation and 4-month data purge.<br/>"
                      "• Provides visual workflow monitoring, error triggers, and automatic retries.", table_cell_style)
        ],
        [
            Paragraph("<b>Google Sheets</b><br/>(Member Directory)", table_cell_bold),
            Paragraph("PEN & Member Master Roster", table_cell_style),
            Paragraph("• Acts as the live, user-friendly roster where society administrative staff can manage police personnel and PEN numbers without needing direct SQL database access.<br/>"
                      "• When an officer messages WhatsApp, n8n queries the sheet in milliseconds to verify PEN authenticity, active membership, and eligibility.<br/>"
                      "• Prevents unauthorized non-members from booking society slots.", table_cell_style)
        ],
        [
            Paragraph("<b>Next.js 14.2</b><br/>(React 18 & App Router)", table_cell_bold),
            Paragraph("Customer & Staff Web Application", table_cell_style),
            Paragraph("• Full-stack React framework utilizing Server-Side Rendering (SSR) and Client Components.<br/>"
                      "• Mobile-first responsive UI built with Tailwind CSS and Lucide React icons.<br/>"
                      "• Dual application routes: Public booking wizard (<code>/b/[token]</code>) and protected staff portal (<code>/app/*</code>).<br/>"
                      "• Production bundle compiled with zero errors across all 18 routes.", table_cell_style)
        ],
        [
            Paragraph("<b>WhatsApp Business API</b><br/>(WAAU / HTTP Gateway)", table_cell_bold),
            Paragraph("Member Messaging Gateway", table_cell_style),
            Paragraph("• Official communication channel for all TDPCS members across Kerala.<br/>"
                      "• Delivers token links, booking passes, reminder alerts, emergency cancellation notices, and surety requirement notifications directly into the member's WhatsApp chat.<br/>"
                      "• Requires zero app download or password memorization for police personnel.", table_cell_style)
        ],
        [
            Paragraph("<b>Supabase Cloud PostgreSQL</b><br/>(AWS Mumbai)", table_cell_bold),
            Paragraph("Relational Database & Core Logic", table_cell_style),
            Paragraph("• Hosted PostgreSQL 15+ database in AWS Mumbai (<code>aws-0-ap-south-1.pooler.supabase.com:5432</code>).<br/>"
                      "• Houses atomic stored procedures (<code>book_slot_internal</code>, <code>extend_booking</code>, <code>auto_generate_open_days</code>).<br/>"
                      "• High-security Row Level Security (RLS) policies protecting member records.<br/>"
                      "• Embedded offline SQLite fallback engine ensuring zero downtime.", table_cell_style)
        ],
        [
            Paragraph("<b>Subdomain & SSL</b><br/>(<code>apt.tdpcs.in</code>)", table_cell_bold),
            Paragraph("Web Routing & Domain Security", table_cell_style),
            Paragraph("• Official branded subdomain configured with DNS A-record pointing to the VPS.<br/>"
                      "• Nginx reverse proxy terminates SSL/TLS (HTTPS) using Let's Encrypt Certbot with automatic renewal.<br/>"
                      "• Proxies secure web traffic to the internal Node.js service running on <b>Port 3015</b>.", table_cell_style)
        ],
        [
            Paragraph("<b>Cloud VPS & PM2</b><br/>(Ubuntu Linux)", table_cell_bold),
            Paragraph("Dedicated Production Server", table_cell_style),
            Paragraph("• High-performance Ubuntu 22.04 LTS VPS with UFW firewall (Ports 80, 443, 22).<br/>"
                      "• Managed by <b>PM2</b> process supervisor (<code>ecosystem.config.js</code>) configured on <b>Port 3015</b>.<br/>"
                      "• Auto-restarts on server reboot or process crash with cluster-ready memory limits.", table_cell_style)
        ]
    ]

    tools_table = Table(tools_data, colWidths=[110, 110, 299])
    tools_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#000000")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#333333")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9F9F9")]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(tools_table)
    story.append(Spacer(1, 10))

    # PAGE 3 END -> PAGE 4
    story.append(PageBreak())

    # ---------------------------------------------------------
    # 4. SECURITY ARCHITECTURE & PRIVACY SAFEGUARDS
    # ---------------------------------------------------------
    story.append(Paragraph("4. SECURITY ARCHITECTURE & PRIVACY SAFEGUARDS", section_heading))
    story.append(Paragraph(
        "Because the system serves active police officers and financial cooperative transactions, security and confidentiality were designed into the core architecture:",
        body_style
    ))

    sec_data = [
        [Paragraph("Security Layer", table_header_style), Paragraph("Threat Prevented", table_header_style), Paragraph("Implementation & Architectural Safeguard", table_header_style)],
        
        [
            Paragraph("<b>Single-Use Tokenized URLs</b><br/><code>/b/[UUIDv4]</code>", table_cell_bold),
            Paragraph("Identity spoofing, URL guessing, phone harvesting.", table_cell_style),
            Paragraph("• Members never enter their phone number on the web. The URL uses a 128-bit UUID token linked to the member's WhatsApp identity in Supabase.<br/>"
                      "• Tokens expire automatically in 2 hours and can only be used once to create a booking.<br/>"
                      "• Public web visitors cannot see or manipulate member data.", table_cell_style)
        ],
        [
            Paragraph("<b>Google Sheet PEN Verification</b>", table_cell_bold),
            Paragraph("Unauthorized bookings by non-members / public.", table_cell_style),
            Paragraph("• n8n automatically matches incoming chat requests against the official Police Employee Number (PEN) master list in Google Sheets before issuing any link.<br/>"
                      "• Only verified police department personnel can generate valid booking sessions.", table_cell_style)
        ],
        [
            Paragraph("<b>Atomic Anti-Collision Locking</b>", table_cell_bold),
            Paragraph("Double bookings, counter collisions, race conditions.", table_cell_style),
            Paragraph("• Database operations (<code>book_slot_internal</code> and <code>extend_booking</code>) use PostgreSQL `FOR UPDATE` row locking.<br/>"
                      "• Counter extensions are strictly rejected if any other booking is scheduled during the extension window or if extending past 12:30 PM lunch break.", table_cell_style)
        ],
        [
            Paragraph("<b>PostgreSQL Row-Level Security (RLS)</b>", table_cell_bold),
            Paragraph("Unauthorized database reads, data leaks.", table_cell_style),
            Paragraph("• All tables (`bookings`, `profiles`, `open_days`, `audit_log`, `settings`) have RLS enabled.<br/>"
                      "• Anonymous browser clients can only execute controlled RPC procedures. Staff access requires authenticated Supabase session tokens with active staff/admin role.", table_cell_style)
        ],
        [
            Paragraph("<b>Automated 4-Month Data Retention</b>", table_cell_bold),
            Paragraph("Indefinite data exposure, regulatory non-compliance.", table_cell_style),
            Paragraph("• Automated daily scheduled cron purges past bookings and audit logs older than 120 days (4 months).<br/>"
                      "• Minimizes sensitive historical data footprint on cloud servers.", table_cell_style)
        ],
        [
            Paragraph("<b>Immutable Audit Logging</b>", table_cell_bold),
            Paragraph("Unaccountable staff actions, dispute ambiguity.", table_cell_style),
            Paragraph("• Every ticket creation, status change, cancellation, time extension, and admin configuration change is recorded in `audit_log` with actor identity and timestamp.", table_cell_style)
        ],
        [
            Paragraph("<b>Transport & Network Security</b>", table_cell_bold),
            Paragraph("Man-in-the-middle attacks, eavesdropping.", table_cell_style),
            Paragraph("• 100% HTTPS TLS 1.3 encryption across web traffic and webhooks.<br/>"
                      "• VPS protected by UFW firewall with SSH key authentication and non-root PM2 process isolation.", table_cell_style)
        ]
    ]

    sec_table = Table(sec_data, colWidths=[110, 110, 299])
    sec_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#000000")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#333333")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9F9F9")]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(sec_table)
    story.append(Spacer(1, 12))

    # ---------------------------------------------------------
    # 5. CONCLUSION & SIGN-OFF
    # ---------------------------------------------------------
    sign_block = []
    sign_block.append(Paragraph("5. SYSTEM HANDOVER & CLIENT SIGN-OFF", section_heading))
    sign_block.append(Paragraph(
        "The TDPCS Appointment Booking & Queue Management System is fully built, live, and verified across all components (WhatsApp, n8n, Google Sheets, Next.js, Supabase, VPS Port 3015, and Nginx SSL). The system delivers a seamless experience for police members while giving society officers full administrative control.",
        body_style
    ))
    sign_block.append(Spacer(1, 8))

    sign_data = [
        [
            Paragraph("<b>DELIVERED BY:</b><br/><br/><br/>____________________________________<br/><b>System Engineering Team</b><br/>Advanced Agentic Engineering<br/>Date: October 2026", body_style),
            Paragraph("<b>CONFIRMED & ACCEPTED BY:</b><br/><br/><br/>____________________________________<br/><b>Authorized Officer / Administrator</b><br/>Thrissur District Police Co-operative Society Ltd.<br/>Date: ________________________", body_style)
        ]
    ]
    sign_table = Table(sign_data, colWidths=[255, 264])
    sign_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#222222")),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FAFAFA")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    sign_block.append(sign_table)
    story.append(KeepTogether(sign_block))

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated: {os.path.abspath(filename)}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "TDPCS_Full_Project_Working_Report.pdf"
    build_pdf(out_file)

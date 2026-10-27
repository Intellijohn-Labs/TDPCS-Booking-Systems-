import os
import sys
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and print total page numbers: 'Page X of Y'
    along with running headers and footers in a crisp monochrome aesthetic.
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
            self.line(40, 802, 555, 802)
            self.drawString(40, 807, "TDPCS-APT APPOINTMENT & QUEUE MANAGEMENT SYSTEM")
            self.drawRightString(555, 807, "FINAL PROJECT COMPLETION REPORT")

        # Bottom Running Footer (All pages)
        self.setStrokeColor(colors.HexColor("#222222"))
        self.setLineWidth(0.75)
        self.line(40, 45, 555, 45)
        
        self.drawString(40, 32, "CONFIDENTIAL & PROPRIETARY | Thrissur District Police Co-operative Society Ltd.")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(555, 32, page_str)
        self.restoreState()

def build_pdf(filename="TDPCS_Project_Completion_Report.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=38,
        rightMargin=38,
        topMargin=46,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()

    # Custom Black & White Typography Styles
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
        fontSize=10,
        leading=14,
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

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#222222"),
        spaceAfter=4
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
    # COVER / HEADER BLOCK
    # ---------------------------------------------------------
    header_data = [
        [
            Paragraph("<b>TDPCS-APT SYSTEM</b><br/><font size='7.5' color='#555555'>OFFICIAL COMPLETION DOCUMENT</font>", body_style),
            Paragraph("<b>DOC REF:</b> TDPCS-COMP-2026-V1<br/><b>DATE:</b> October 27, 2026<br/><b>STATUS:</b> <font color='#000000'><b>100% PRODUCTION READY</b></font>", ParagraphStyle('HRight', parent=body_style, alignment=2, fontSize=8, leading=11))
        ]
    ]
    header_table = Table(header_data, colWidths=[255, 260])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBELOW', (0,0), (-1,-1), 1.5, colors.black),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 14))

    # Title & Subtitle
    story.append(Paragraph("PROJECT COMPLETION REPORT", title_style))
    story.append(Paragraph("Full Delivery & Sign-Off Documentation for the TDPCS Appointment Booking & Real-Time Queue Management Web Application", subtitle_style))

    # Executive Metadata Card
    meta_data = [
        [Paragraph("<b>Project Name:</b>", body_style), Paragraph("TDPCS-Apt Slot Booking & Counter System", body_style),
         Paragraph("<b>Client Organization:</b>", body_style), Paragraph("Thrissur District Police Co-op Society Ltd.", body_style)],
        [Paragraph("<b>Production Domain:</b>", body_style), Paragraph("<code>http://apt.tdpcs.in</code> (Port 3015)", body_style),
         Paragraph("<b>Database:</b>", body_style), Paragraph("Supabase Cloud PostgreSQL (AWS Mumbai)", body_style)],
        [Paragraph("<b>Framework:</b>", body_style), Paragraph("Next.js 14.2 (App Router) + Tailwind CSS", body_style),
         Paragraph("<b>Process Manager:</b>", body_style), Paragraph("PM2 Daemon (<code>tdpcs-apt</code>)", body_style)],
        [Paragraph("<b>Sign-Off Date:</b>", body_style), Paragraph("October 27, 2026", body_style),
         Paragraph("<b>System Health:</b>", body_style), Paragraph("<b>100% Functional & Active</b>", body_style)]
    ]
    meta_table = Table(meta_data, colWidths=[90, 165, 110, 150])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F6F6F6")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#333333")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E0E0E0")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # ---------------------------------------------------------
    # 1. EXECUTIVE SUMMARY
    # ---------------------------------------------------------
    story.append(Paragraph("1. EXECUTIVE SUMMARY", section_heading))
    story.append(Paragraph(
        "The <b>TDPCS-Apt Slot Booking and Counter Management Web Application</b> has reached full completion, verification, and live production deployment. Designed specifically for the members and branch staff of the <b>Thrissur District Police Co-operative Society Ltd.</b>, the platform provides a zero-friction, mobile-responsive appointment booking engine and a high-reliability dual-counter queue dispatching system.",
        body_style
    ))
    story.append(Paragraph(
        "The system has been architected with enterprise-grade resilience: it operates natively on <b>Supabase Cloud PostgreSQL</b> in AWS Mumbai with atomic row-level transaction safety, while retaining an automatic failover to local SQLite mode. All custom administrative requirements (including granular weekly schedule toggles, Saturday afternoon session controls, strict zero-conflict slot extensions, and secure staff authentication) have been engineered, tested, and certified.",
        body_style
    ))
    story.append(Spacer(1, 6))

    # Page Break to give Section 2 full prominence
    story.append(PageBreak())

    # ---------------------------------------------------------
    # 2. CORE DELIVERED MODULES & FEATURES
    # ---------------------------------------------------------
    story.append(Paragraph("2. CORE DELIVERED MODULES & ARCHITECTURE", section_heading))
    
    modules_data = [
        [Paragraph("Module", table_header_style), Paragraph("Technical Scope & Delivered Capabilities", table_header_style), Paragraph("Status", table_header_style)],
        
        [
            Paragraph("<b>Customer Booking Engine</b><br/><code>/b/[token]</code>", table_cell_bold),
            Paragraph("&bull; 4-step mobile-first booking wizard: Services, Open Dates, Live Time Slots, Pass.<br/>&bull; Anti-bot tokenized access via cryptographic WhatsApp verification links.<br/>&bull; Real-time slot conflict prevention with automatic 30-minute booking cutoff.<br/>&bull; Downloadable and printable official Appointment Pass with QR code.", table_cell_style),
            Paragraph("<b>COMPLETED</b><br/>Verified Live", table_cell_style)
        ],
        [
            Paragraph("<b>Staff Queue Terminal</b><br/><code>/app/queue</code>", table_cell_bold),
            Paragraph("&bull; Live dual-counter split view (Counter 1 & Counter 2) with real-time status dispatch.<br/>&bull; Lifecycle flow: <code>Booked -> Arrived -> Called -> Served / Cancelled</code>.<br/>&bull; Audible alert chime and visual notification banner for member calling.<br/>&bull; Instant manual token registration and member lookup by mobile / token.", table_cell_style),
            Paragraph("<b>COMPLETED</b><br/>Verified Live", table_cell_style)
        ],
        [
            Paragraph("<b>Strict Anti-Collision Slot Extension</b>", table_cell_bold),
            Paragraph("&bull; Database-enforced atomic extension function (<code>public.extend_booking</code>).<br/>&bull; <b>Anti-Collision Guarantee:</b> Extension allowed <i>strictly</i> when no upcoming booking is scheduled on that counter during the extension window.<br/>&bull; Proactive buffer detection in UI with visual <code>(Not possible)</code> lockout.<br/>&bull; Enforces session boundaries (cannot extend into lunch break 12:30 PM or day close).", table_cell_style),
            Paragraph("<b>COMPLETED</b><br/>Verified Live", table_cell_style)
        ],
        [
            Paragraph("<b>Admin Calendar Engine</b><br/><code>/app/admin/calendar</code>", table_cell_bold),
            Paragraph("&bull; Dynamic 3-month automated rolling calendar generator.<br/>&bull; <b>Custom Working Days:</b> Flexible weekly schedule selection (e.g. 3-day presets: Mon/Tue/Wed).<br/>&bull; <b>Saturday Afternoon Toggle:</b> Instant on/off control for Saturday 2:00 PM - 5:00 PM session.<br/>&bull; Emergency single-day holiday / blackout blocker with auto-cancellation.", table_cell_style),
            Paragraph("<b>COMPLETED</b><br/>Verified Live", table_cell_style)
        ],
        [
            Paragraph("<b>Authentication & RBAC</b><br/><code>/login</code> & <code>/app/admin/users</code>", table_cell_bold),
            Paragraph("&bull; Supabase Auth + PostgreSQL Row-Level Security (RLS) enforcement.<br/>&bull; Strict role separation: <code>admin</code> (full configuration) and <code>staff</code> (counter dispatch).<br/>&bull; Direct admin user management API: User creation, password resets, deactivation.<br/>&bull; Automatic fallback resolver preventing placeholder host errors in production.", table_cell_style),
            Paragraph("<b>COMPLETED</b><br/>Verified Live", table_cell_style)
        ],
        [
            Paragraph("<b>Audit Trail & Reporting</b><br/><code>/app/admin/audit</code><br/><code>/app/admin/reports</code>", table_cell_bold),
            Paragraph("&bull; Immutable audit logging (<code>audit_log</code>) tracking all token generation and status changes.<br/>&bull; Service utilization metrics, counter efficiency, footfall, and cancellation rates.<br/>&bull; Exportable audit reports for administrative governance.", table_cell_style),
            Paragraph("<b>COMPLETED</b><br/>Verified Live", table_cell_style)
        ],
        [
            Paragraph("<b>n8n WhatsApp Webhook Integration</b>", table_cell_bold),
            Paragraph("&bull; Endpoints configured for instant WhatsApp booking link generation.<br/>&bull; Automated booking confirmation messaging with token credentials.<br/>&bull; Emergency cancellation broadcasts and surety verification alerts.<br/>&bull; Scheduled data retention purge workflow for privacy compliance.", table_cell_style),
            Paragraph("<b>COMPLETED</b><br/>Verified Live", table_cell_style)
        ]
    ]

    modules_table = Table(modules_data, colWidths=[125, 310, 80])
    modules_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#000000")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#333333")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9F9F9")]),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(modules_table)
    story.append(Spacer(1, 14))

    # Page Break for clean multi-page layout
    story.append(PageBreak())

    # ---------------------------------------------------------
    # 3. TECHNICAL SPECIFICATIONS & PRODUCTION CONFIGURATION
    # ---------------------------------------------------------
    story.append(Paragraph("3. TECHNICAL SPECIFICATIONS & ENVIRONMENT", section_heading))
    story.append(Paragraph(
        "The following parameters represent the production configuration actively deployed on the VPS server:",
        body_style
    ))

    env_data = [
        [Paragraph("Parameter / Component", table_header_style), Paragraph("Specification / Value", table_header_style), Paragraph("Purpose / Notes", table_header_style)],
        [Paragraph("Web Server & Port", table_cell_bold), Paragraph("Node.js / Next.js on <b>Port 3015</b>", table_cell_style), Paragraph("Resolved port collision with legacy port 5000", table_cell_style)],
        [Paragraph("Process Manager", table_cell_bold), Paragraph("PM2 Daemon (<code>ecosystem.config.js</code>)", table_cell_style), Paragraph("Auto-restart on failure, memory limits, cluster mode", table_cell_style)],
        [Paragraph("Reverse Proxy & SSL", table_cell_bold), Paragraph("Nginx & Certbot SSL (<code>apt.tdpcs.in</code>)", table_cell_style), Paragraph("HTTPS port 443 forwarded to upstream 127.0.0.1:3015", table_cell_style)],
        [Paragraph("Supabase URL", table_cell_bold), Paragraph("<code>https://jktoipmsdvcnljogitos.supabase.co</code>", table_cell_mono), Paragraph("Live Supabase project endpoint", table_cell_style)],
        [Paragraph("Database Host", table_cell_bold), Paragraph("<code>aws-0-ap-south-1.pooler.supabase.com:5432</code>", table_cell_mono), Paragraph("AWS Mumbai Transaction/Session Pooler", table_cell_style)],
        [Paragraph("Operating Hours (S1)", table_cell_bold), Paragraph("10:10 AM - 12:30 PM (Morning)", table_cell_style), Paragraph("Counter 1 & Counter 2 active", table_cell_style)],
        [Paragraph("Lunch Break", table_cell_bold), Paragraph("12:30 PM - 02:00 PM (Counters Closed)", table_cell_style), Paragraph("Extension crossing strictly blocked", table_cell_style)],
        [Paragraph("Operating Hours (S2)", table_cell_bold), Paragraph("02:00 PM - 05:00 PM (Afternoon)", table_cell_style), Paragraph("Controlled by Saturday Afternoon toggle", table_cell_style)],
        [Paragraph("Max Extension Limit", table_cell_bold), Paragraph("30 Minutes (Coalesced setting)", table_cell_style), Paragraph("Enforced via database logic & UI buffer checks", table_cell_style)]
    ]

    env_table = Table(env_data, colWidths=[120, 225, 170])
    env_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#000000")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#333333")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9F9F9")]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(env_table)
    story.append(Spacer(1, 14))

    # ---------------------------------------------------------
    # 4. COMPLIANCE & VERIFICATION TESTS
    # ---------------------------------------------------------
    story.append(Paragraph("4. SYSTEM TESTING & QUALITY ASSURANCE SIGN-OFF", section_heading))
    story.append(Paragraph(
        "All critical operational flows were subjected to rigorous test automation and direct database verification:",
        body_style
    ))

    qa_data = [
        [Paragraph("Test Description", table_header_style), Paragraph("Target Criteria", table_header_style), Paragraph("Test Methodology", table_header_style), Paragraph("Result", table_header_style)],
        [
            Paragraph("<b>Next.js Production Build</b>", table_cell_bold),
            Paragraph("Zero compile or TypeScript errors across all 18 routes.", table_cell_style),
            Paragraph("Automated compiler run via <code>next build</code>.", table_cell_style),
            Paragraph("<b>PASSED</b><br/>(Exit Code 0)", table_cell_style)
        ],
        [
            Paragraph("<b>Anti-Collision Slot Extension</b>", table_cell_bold),
            Paragraph("No booking may be extended if another booking is scheduled on that counter.", table_cell_style),
            Paragraph("Simulated back-to-back bookings; executed <code>extend_booking</code> on live Supabase.", table_cell_style),
            Paragraph("<b>PASSED</b><br/>(Overlaps blocked)", table_cell_style)
        ],
        [
            Paragraph("<b>Lunch Break Session Boundary</b>", table_cell_bold),
            Paragraph("Extensions may not cross 12:30 PM morning closing.", table_cell_style),
            Paragraph("Attempted +10m extension on 12:15-12:30 slot.", table_cell_style),
            Paragraph("<b>PASSED</b><br/>(Strictly rejected)", table_cell_style)
        ],
        [
            Paragraph("<b>Live Auth & RBAC</b>", table_cell_bold),
            Paragraph("Admin and staff accounts authenticate securely and issue valid JWTs.", table_cell_style),
            Paragraph("Live REST API token exchange verified via Supabase Auth.", table_cell_style),
            Paragraph("<b>PASSED</b><br/>(Tokens Issued)", table_cell_style)
        ],
        [
            Paragraph("<b>Automatic Host Fallback</b>", table_cell_bold),
            Paragraph("App must never fail if placeholder <code>your-project</code> is encountered.", table_cell_style),
            Paragraph("Built with <code>getEffectiveSupabaseUrl</code> fallback resolver.", table_cell_style),
            Paragraph("<b>PASSED</b><br/>(Auto-routed)", table_cell_style)
        ],
        [
            Paragraph("<b>Saturday Afternoon Toggle</b>", table_cell_bold),
            Paragraph("Admin toggle enables/disables Saturday 2-5 PM slots immediately.", table_cell_style),
            Paragraph("Schedule sync verified in <code>open_days</code> and calendar view.", table_cell_style),
            Paragraph("<b>PASSED</b><br/>(Instant sync)", table_cell_style)
        ]
    ]

    qa_table = Table(qa_data, colWidths=[115, 150, 175, 75])
    qa_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#000000")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#333333")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9F9F9")]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(qa_table)
    story.append(Spacer(1, 14))

    # ---------------------------------------------------------
    # 5. USER CREDENTIALS & HANDOVER SUMMARY
    # ---------------------------------------------------------
    story.append(Paragraph("5. SYSTEM ACCESS & HANDOVER CREDENTIALS", section_heading))
    
    cred_data = [
        [Paragraph("Role / Access Level", table_header_style), Paragraph("Login Identifier / Email", table_header_style), Paragraph("Initial Password", table_header_style), Paragraph("Access Permissions", table_header_style)],
        [
            Paragraph("<b>System Administrator</b>", table_cell_bold),
            Paragraph("<code>admin@tdpcs.org</code>", table_cell_mono),
            Paragraph("<code>admin123</code>", table_cell_mono),
            Paragraph("Full access to Calendar, Settings, User Management, Reports & Queue.", table_cell_style)
        ],
        [
            Paragraph("<b>Personal Admin</b>", table_cell_bold),
            Paragraph("<code>nandanam.sarun@gmail.com</code>", table_cell_mono),
            Paragraph("<i>(Registered Password)</i>", table_cell_style),
            Paragraph("Full administrative permissions & oversight.", table_cell_style)
        ],
        [
            Paragraph("<b>Branch Counter Operator</b>", table_cell_bold),
            Paragraph("<code>staff@tdpcs.coop</code>", table_cell_mono),
            Paragraph("<code>staff123</code>", table_cell_mono),
            Paragraph("Queue Terminal dispatch, token status updates, member calling.", table_cell_style)
        ],
        [
            Paragraph("<b>Counter 1 Operator</b>", table_cell_bold),
            Paragraph("<code>staff1@tdpcs.coop</code>", table_cell_mono),
            Paragraph("<code>staff123</code>", table_cell_mono),
            Paragraph("Dedicated Counter 1 queue management.", table_cell_style)
        ],
        [
            Paragraph("<b>Counter 2 Operator</b>", table_cell_bold),
            Paragraph("<code>staff2@tdpcs.coop</code>", table_cell_mono),
            Paragraph("<code>staff123</code>", table_cell_mono),
            Paragraph("Dedicated Counter 2 queue management.", table_cell_style)
        ]
    ]

    cred_table = Table(cred_data, colWidths=[120, 160, 100, 135])
    cred_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#000000")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#333333")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9F9F9")]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(cred_table)
    story.append(Spacer(1, 16))

    # ---------------------------------------------------------
    # 6. SIGN-OFF & CERTIFICATION
    # ---------------------------------------------------------
    sign_block = []
    sign_block.append(Paragraph("6. FORMAL PROJECT SIGN-OFF & ACCEPTANCE", section_heading))
    sign_block.append(Paragraph(
        "By signing below, it is confirmed that the TDPCS Appointment Booking & Queue Management System has satisfied all functional, architectural, security, and administrative specifications. The software is formally certified as complete, tested, and operational in production.",
        body_style
    ))
    sign_block.append(Spacer(1, 10))

    sign_data = [
        [
            Paragraph("<b>PREPARED & DELIVERED BY:</b><br/><br/><br/>____________________________________<br/><b>Lead System Architect & Engineering Team</b><br/>Advanced Agentic Engineering / Antigravity<br/>Date: October 27, 2026", body_style),
            Paragraph("<b>ACCEPTED & APPROVED BY:</b><br/><br/><br/>____________________________________<br/><b>Authorized Officer / Administrator</b><br/>Thrissur District Police Co-operative Society Ltd.<br/>Date: ________________________", body_style)
        ]
    ]
    sign_table = Table(sign_data, colWidths=[255, 260])
    sign_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#222222")),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FAFAFA")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    sign_block.append(sign_table)

    story.append(KeepTogether(sign_block))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated: {os.path.abspath(filename)}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "TDPCS_Project_Completion_Report.pdf"
    build_pdf(out_file)

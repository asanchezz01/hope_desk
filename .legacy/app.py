import calendar
import hashlib
import secrets
from collections import defaultdict
from datetime import datetime, timedelta
from functools import wraps
from email.message import EmailMessage
from html import escape
import smtplib
import ssl
from io import BytesIO
from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import urlopen

from flask import Flask, flash, redirect, render_template, request, send_file, session, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from werkzeug.security import check_password_hash, generate_password_hash
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-this-in-production"


def build_database_uri() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return database_url

    db_host = os.getenv("DB_HOST", "10.1.4.82").strip()
    db_port = os.getenv("DB_PORT", "5433").strip()
    db_name = os.getenv("DB_NAME", "hopedesk").strip()
    db_user = quote_plus(os.getenv("DB_USER", "postgres").strip())
    db_password = quote_plus(os.getenv("DB_PASSWORD", "postgres").strip())

    return f"postgresql+psycopg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


app.config["SQLALCHEMY_DATABASE_URI"] = build_database_uri()
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}

db = SQLAlchemy(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # client | technician
    is_superuser = db.Column(db.Boolean, default=False)
    must_change_password = db.Column(db.Boolean, nullable=False, default=False)
    reset_token_hash = db.Column(db.String(64), nullable=True)
    reset_token_expires_at = db.Column(db.DateTime, nullable=True)

    client_tickets = db.relationship(
        "Ticket", foreign_keys="Ticket.client_id", backref="client", lazy=True
    )
    tech_tickets = db.relationship(
        "Ticket", foreign_keys="Ticket.technician_id", backref="technician", lazy=True
    )


class Ticket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(30), nullable=False, default="aberto")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    client_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    technician_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    system_module_id = db.Column(db.Integer, db.ForeignKey("system_module.id"), nullable=True)

    activities = db.relationship("Activity", backref="ticket", lazy=True, cascade="all, delete-orphan")
    system_module = db.relationship("SystemModule", backref="tickets", lazy=True)

    @property
    def total_hours(self) -> float:
        return round(sum(activity.duration_hours for activity in self.activities), 2)


class Activity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey("ticket.id"), nullable=False)
    notes = db.Column(db.Text, nullable=False)
    started_at = db.Column(db.DateTime, nullable=False)
    ended_at = db.Column(db.DateTime, nullable=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    created_by = db.relationship("User")

    @property
    def duration_hours(self) -> float:
        delta = self.ended_at - self.started_at
        return max(delta.total_seconds() / 3600, 0)


class SystemParameter(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(120), nullable=False, unique=True)
    value = db.Column(db.Text, nullable=False, default="")


class SystemModule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)


class PaymentRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    paid_at = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False, default=0.0)
    paid_hours = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    @property
    def paid_hours_display(self) -> float:
        return round(self.paid_hours, 2)

    @property
    def amount_display(self) -> float:
        return round(self.amount, 2)


def ensure_ticket_schema_updates() -> None:
    inspector = inspect(db.engine)
    if "ticket" not in inspector.get_table_names():
        return

    ticket_columns = {column["name"] for column in inspector.get_columns("ticket")}
    if "system_module_id" in ticket_columns:
        return

    with db.engine.begin() as connection:
        connection.execute(text("ALTER TABLE ticket ADD COLUMN system_module_id INTEGER"))


def ensure_user_schema_updates() -> None:
    inspector = inspect(db.engine)
    if "user" not in inspector.get_table_names():
        return

    user_columns = {column["name"] for column in inspector.get_columns("user")}
    statements = []
    if "must_change_password" not in user_columns:
        statements.append('ALTER TABLE "user" ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE')
    if "reset_token_hash" not in user_columns:
        statements.append('ALTER TABLE "user" ADD COLUMN reset_token_hash VARCHAR(64)')
    if "reset_token_expires_at" not in user_columns:
        statements.append('ALTER TABLE "user" ADD COLUMN reset_token_expires_at TIMESTAMP')

    if not statements:
        return

    with db.engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_system_parameters() -> None:
    defaults = {
        "company_logo": "",
        "company_name": "Hope Desk",
        "company_address": "Endereço não informado",
        "monthly_hours_allowance": "16",
        "hours_bank_closing_date": "2000-01-01",
    }
    existing = {
        row.key for row in SystemParameter.query.filter(SystemParameter.key.in_(defaults.keys())).all()
    }
    for key, value in defaults.items():
        if key not in existing:
            db.session.add(SystemParameter(key=key, value=value))
    db.session.commit()


def get_system_parameter(key: str, default: str = "") -> str:
    record = SystemParameter.query.filter_by(key=key).first()
    if not record or not record.value:
        return default
    return record.value.strip()


def set_system_parameter(key: str, value: str) -> None:
    record = SystemParameter.query.filter_by(key=key).first()
    normalized = value.strip()
    if record:
        record.value = normalized
        return
    db.session.add(SystemParameter(key=key, value=normalized))


def resolve_period(year_raw: str | None, month_raw: str | None) -> tuple[int, int]:
    today = datetime.now()

    try:
        selected_year = int(year_raw or today.year)
    except (TypeError, ValueError):
        selected_year = today.year

    try:
        selected_month = int(month_raw or today.month)
    except (TypeError, ValueError):
        selected_month = today.month

    if selected_month < 1 or selected_month > 12:
        selected_month = today.month

    return selected_year, selected_month


def month_period_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1)
    if month == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, month + 1, 1)
    return start, end


def resolve_date_period(start_raw: str | None, end_raw: str | None) -> tuple[datetime, datetime, str, str]:
    today = datetime.now()
    default_start, default_end = month_period_bounds(today.year, today.month)

    try:
        start_date = datetime.strptime(start_raw or default_start.strftime("%Y-%m-%d"), "%Y-%m-%d")
    except (TypeError, ValueError):
        start_date = default_start

    try:
        end_date = datetime.strptime(end_raw or (default_end - timedelta(days=1)).strftime("%Y-%m-%d"), "%Y-%m-%d")
    except (TypeError, ValueError):
        end_date = default_end - timedelta(days=1)

    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_exclusive = (end_date + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

    if end_exclusive <= start_date:
        start_date, end_exclusive = default_start, default_end

    return (
        start_date,
        end_exclusive,
        start_date.strftime("%Y-%m-%d"),
        (end_exclusive - timedelta(days=1)).strftime("%Y-%m-%d"),
    )


def add_months(base_date: datetime, months: int) -> datetime:
    month_index = (base_date.month - 1) + months
    target_year = base_date.year + (month_index // 12)
    target_month = (month_index % 12) + 1
    target_day = min(base_date.day, calendar.monthrange(target_year, target_month)[1])
    return base_date.replace(year=target_year, month=target_month, day=target_day)


def resolve_hours_bank_window(closing_date_raw: str, reference: datetime) -> tuple[datetime, datetime]:
    try:
        anchor = datetime.strptime(closing_date_raw, "%Y-%m-%d")
    except (TypeError, ValueError):
        anchor = reference.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        anchor = anchor.replace(hour=0, minute=0, second=0, microsecond=0)

    while anchor > reference:
        anchor = add_months(anchor, -6)

    next_reset = add_months(anchor, 6)
    while next_reset <= reference:
        anchor = next_reset
        next_reset = add_months(anchor, 6)

    return anchor, next_reset


def calculate_accumulated_hours(user_id: int, role: str, reference: datetime) -> tuple[float, float, float, datetime, datetime]:
    franchise_hours_raw = get_system_parameter("monthly_hours_allowance", "16")
    try:
        franchise_hours = float(franchise_hours_raw.replace(",", "."))
    except ValueError:
        franchise_hours = 16.0
    franchise_hours = max(franchise_hours, 0)

    closing_date_raw = get_system_parameter("hours_bank_closing_date", "")
    cycle_start, cycle_end = resolve_hours_bank_window(closing_date_raw, reference)

    activity_scope = Activity.query.join(Ticket, Activity.ticket_id == Ticket.id).filter(
        Activity.ended_at > cycle_start,
        Activity.started_at < reference,
    )
    if role == "client":
        activity_scope = activity_scope.filter(Ticket.client_id == user_id)

    monthly_totals: dict[tuple[int, int], float] = defaultdict(float)
    for activity in activity_scope.all():
        overlap_start = max(activity.started_at, cycle_start)
        overlap_end = min(activity.ended_at, reference)
        if overlap_end <= overlap_start:
            continue

        cursor = overlap_start
        while cursor < overlap_end:
            if cursor.month == 12:
                next_month = datetime(cursor.year + 1, 1, 1)
            else:
                next_month = datetime(cursor.year, cursor.month + 1, 1)
            segment_end = min(overlap_end, next_month)
            monthly_totals[(cursor.year, cursor.month)] += (segment_end - cursor).total_seconds() / 3600
            cursor = segment_end

    accumulated = 0.0
    for month_hours in monthly_totals.values():
        accumulated += max(month_hours - franchise_hours, 0)

    payment_scope = PaymentRecord.query.filter(
        PaymentRecord.paid_at >= cycle_start.date(),
        PaymentRecord.paid_at <= reference.date(),
    )
    paid_hours = round(sum(payment.paid_hours for payment in payment_scope.all()), 2)
    net_accumulated = max(accumulated - paid_hours, 0)

    return round(net_accumulated, 2), paid_hours, round(franchise_hours, 2), cycle_start, cycle_end


def calculate_paid_hours_for_month(selected_year: int, selected_month: int) -> float:
    period_start, period_end = month_period_bounds(selected_year, selected_month)
    payment_scope = PaymentRecord.query.filter(
        PaymentRecord.paid_at >= period_start.date(),
        PaymentRecord.paid_at < period_end.date(),
    )
    return round(sum(payment.paid_hours for payment in payment_scope.all()), 2)


def normalize_status(status: str) -> str:
    labels = {
        "aberto": "Em aberto",
        "em_andamento": "Em andamento",
        "resolvido": "Concluído",
        "fechado": "Fechado",
    }
    return labels.get(status, status.replace("_", " ").title())


def try_build_logo(parameter_value: str) -> Image | None:
    logo_ref = parameter_value.strip()
    if not logo_ref:
        return None

    try:
        reader: ImageReader
        image_source: str | BytesIO
        if logo_ref.startswith(("http://", "https://")):
            with urlopen(logo_ref, timeout=8) as response:
                logo_data = response.read()
            image_source = BytesIO(logo_data)
            reader = ImageReader(image_source)
        else:
            logo_path = Path(logo_ref)
            if not logo_path.is_absolute():
                logo_path = Path(app.root_path) / logo_path
            if not logo_path.exists():
                return None
            image_source = str(logo_path)
            reader = ImageReader(image_source)

        source_width, source_height = reader.getSize()
        if source_width <= 0 or source_height <= 0:
            return None

        max_width = 35 * mm
        max_height = 20 * mm
        scale = min(max_width / source_width, max_height / source_height)
        draw_width = source_width * scale
        draw_height = source_height * scale

        if isinstance(image_source, BytesIO):
            image_source.seek(0)
        image = Image(image_source, width=draw_width, height=draw_height)
        image.hAlign = "LEFT"
        return image
    except Exception:
        app.logger.exception("Falha ao carregar logo do parâmetro company_logo.")
        return None


def build_services_report_rows(selected_year: int, selected_month: int, user_id: int, role: str) -> tuple[list[dict], float]:
    period_start, period_end = month_period_bounds(selected_year, selected_month)
    period_end_display = period_end - timedelta(seconds=1)
    activity_scope = (
        Activity.query.join(Ticket, Activity.ticket_id == Ticket.id)
        .filter(Activity.ended_at > period_start, Activity.started_at < period_end)
        .order_by(Activity.ended_at.desc())
    )
    if role == "client":
        activity_scope = activity_scope.filter(Ticket.client_id == user_id)

    activities = activity_scope.all()
    report_rows: list[dict] = []
    for activity in activities:
        ticket = activity.ticket
        if not ticket:
            continue

        overlap_start = max(activity.started_at, period_start)
        overlap_end = min(activity.ended_at, period_end)
        overlap_hours = max((overlap_end - overlap_start).total_seconds() / 3600, 0)
        if overlap_hours <= 0:
            continue

        activity_end_for_period = min(activity.ended_at, period_end_display)
        technician = activity.created_by or ticket.technician
        report_rows.append(
            {
                "ticket_id": ticket.id,
                "last_activity_at": activity_end_for_period,
                "title": ticket.title,
                "service": activity.notes,
                "status": normalize_status(ticket.status),
                "client_name": ticket.client.name if ticket.client else "-",
                "technician_name": technician.name if technician else "-",
                "hours": round(overlap_hours, 2),
            }
        )

    report_rows = sorted(report_rows, key=lambda item: item["last_activity_at"], reverse=True)
    total_hours = round(sum(row["hours"] for row in report_rows), 2)
    return report_rows, total_hours


def calculate_external_ticket_activity_hours(selected_year: int, selected_month: int, user_id: int, role: str) -> float:
    period_start, period_end = month_period_bounds(selected_year, selected_month)
    ticket_year_expr = db.extract("year", Ticket.created_at)
    ticket_month_expr = db.extract("month", Ticket.created_at)
    activity_scope = (
        Activity.query.join(Ticket, Activity.ticket_id == Ticket.id)
        .filter(Activity.ended_at > period_start, Activity.started_at < period_end)
        .filter((ticket_year_expr != selected_year) | (ticket_month_expr != selected_month))
    )
    if role == "client":
        activity_scope = activity_scope.filter(Ticket.client_id == user_id)

    total_hours = 0.0
    for activity in activity_scope.all():
        overlap_start = max(activity.started_at, period_start)
        overlap_end = min(activity.ended_at, period_end)
        total_hours += max((overlap_end - overlap_start).total_seconds() / 3600, 0)

    return round(total_hours, 2)


def build_activity_report(
    period_start: datetime,
    period_end: datetime,
    user_id: int,
    role: str,
) -> tuple[list[dict], list[dict], float]:
    activity_scope = (
        Activity.query.join(Ticket, Activity.ticket_id == Ticket.id)
        .filter(Activity.ended_at > period_start, Activity.started_at < period_end)
        .order_by(Ticket.id.asc(), Activity.started_at.asc())
    )
    if role == "client":
        activity_scope = activity_scope.filter(Ticket.client_id == user_id)

    grouped: dict[int, dict] = {}
    technician_totals: dict[int, dict] = {}

    for activity in activity_scope.all():
        ticket = activity.ticket
        if not ticket:
            continue

        overlap_start = max(activity.started_at, period_start)
        overlap_end = min(activity.ended_at, period_end)
        overlap_hours = max((overlap_end - overlap_start).total_seconds() / 3600, 0)
        if overlap_hours <= 0:
            continue

        ticket_row = grouped.get(ticket.id)
        if ticket_row is None:
            ticket_row = {
                "ticket_id": ticket.id,
                "title": ticket.title,
                "description": ticket.description,
                "status": normalize_status(ticket.status),
                "client_name": ticket.client.name if ticket.client else "-",
                "assigned_technician": ticket.technician.name if ticket.technician else "-",
                "module_name": ticket.system_module.name if ticket.system_module else "-",
                "created_at": ticket.created_at,
                "total_hours": 0.0,
                "activities": [],
            }
            grouped[ticket.id] = ticket_row

        technician = activity.created_by
        technician_name = technician.name if technician else "Técnico não informado"
        activity_row = {
            "started_at": activity.started_at,
            "ended_at": activity.ended_at,
            "period_started_at": overlap_start,
            "period_ended_at": overlap_end,
            "technician_name": technician_name,
            "notes": activity.notes,
            "hours": round(overlap_hours, 2),
        }
        ticket_row["activities"].append(activity_row)
        ticket_row["total_hours"] += overlap_hours

        technician_key = technician.id if technician else 0
        technician_row = technician_totals.setdefault(
            technician_key,
            {"technician_name": technician_name, "hours": 0.0},
        )
        technician_row["hours"] += overlap_hours

    tickets = sorted(grouped.values(), key=lambda item: item["ticket_id"])
    for ticket_row in tickets:
        ticket_row["total_hours"] = round(ticket_row["total_hours"], 2)

    totals_by_technician = sorted(
        technician_totals.values(),
        key=lambda item: item["technician_name"].lower(),
    )
    for technician_row in totals_by_technician:
        technician_row["hours"] = round(technician_row["hours"], 2)

    total_hours = round(sum(ticket_row["total_hours"] for ticket_row in tickets), 2)
    return tickets, totals_by_technician, total_hours


def ensure_superuser() -> str:
    superuser_email = "superuser@hope.com"
    superuser_password = os.getenv("SUPERUSER_PASSWORD", "newhope")

    if not superuser_password:
        return "SUPERUSER_PASSWORD vazio. Superuser não foi criado."

    user = User.query.filter_by(email=superuser_email).first()
    if not user:
        user = User(
            name="Super User",
            email=superuser_email,
            password_hash=generate_password_hash(superuser_password),
            role="technician",
            is_superuser=True,
        )
        db.session.add(user)
        db.session.commit()
        return "Superuser criado."

    updated = False
    if user.role != "technician":
        user.role = "technician"
        updated = True
    if not user.is_superuser:
        user.is_superuser = True
        updated = True
    if not check_password_hash(user.password_hash, superuser_password):
        user.password_hash = generate_password_hash(superuser_password)
        updated = True

    if updated:
        db.session.commit()
        return "Superuser atualizado."

    return "Superuser já existente."


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            flash("Faça login para continuar.", "warning")
            return redirect(url_for("login"))
        return f(*args, **kwargs)

    return wrapper


def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user_role = session.get("role")
            is_super = session.get("is_superuser", False)
            if user_role not in roles and not is_super:
                flash("Você não tem permissão para acessar esta página.", "danger")
                return redirect(url_for("dashboard"))
            return f(*args, **kwargs)

        return wrapper

    return decorator


@app.before_request
def enforce_password_change():
    if "user_id" not in session or not session.get("must_change_password"):
        return None
    if request.endpoint in {None, "static", "change_password", "logout"}:
        return None
    flash("Você precisa definir uma nova senha antes de continuar.", "warning")
    return redirect(url_for("change_password"))


def can_delete_by_month(record_date: datetime, is_superuser: bool) -> bool:
    now = datetime.now()
    is_current_month = record_date.year == now.year and record_date.month == now.month
    return is_current_month or is_superuser


def parse_bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def send_email(recipients: list[str], subject: str, body: str) -> bool:
    mail_enabled = parse_bool_env("MAIL_ENABLED", True)
    if not mail_enabled:
        app.logger.info("Envio de e-mail desativado por MAIL_ENABLED=false.")
        return False

    smtp_host = os.getenv("MAIL_SMTP", "").strip()
    smtp_user = os.getenv("MAIL_USER", "").strip()
    smtp_pass = os.getenv("MAIL_PASS", "").strip()
    smtp_port = int(os.getenv("MAIL_PORT", "587"))
    smtp_use_tls = parse_bool_env("MAIL_USE_TLS", True)
    smtp_from = os.getenv("MAIL_FROM", smtp_user).strip()

    if not smtp_host or not smtp_user or not smtp_pass or not smtp_from:
        app.logger.warning("SMTP não configurado. E-mail não enviado.")
        return False

    if not recipients:
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = ", ".join(recipients)
    msg.set_content(body)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            server.ehlo()
            if smtp_use_tls:
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return True
    except Exception:
        app.logger.exception("Falha ao enviar e-mail para %s", recipients)
        return False


RESET_TOKEN_MAX_AGE_HOURS = 2


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_password_reset_token(user: "User") -> str:
    token = secrets.token_urlsafe(32)
    user.reset_token_hash = hash_reset_token(token)
    user.reset_token_expires_at = datetime.utcnow() + timedelta(hours=RESET_TOKEN_MAX_AGE_HOURS)
    return token


def find_user_by_reset_token(token: str) -> "User | None":
    if not token:
        return None
    user = User.query.filter_by(reset_token_hash=hash_reset_token(token)).first()
    if not user or not user.reset_token_expires_at:
        return None
    if user.reset_token_expires_at < datetime.utcnow():
        return None
    return user


def send_password_reset_email(user: "User") -> bool:
    if not user.email:
        return False

    token = issue_password_reset_token(user)
    db.session.commit()

    reset_url = url_for("reset_password", token=token, _external=True)
    body = (
        f"Ola, {user.name}.\n\n"
        "Recebemos uma solicitacao para troca da sua senha no Hope Desk.\n\n"
        f"Para definir uma nova senha, acesse o link abaixo (valido por {RESET_TOKEN_MAX_AGE_HOURS} horas):\n"
        f"{reset_url}\n\n"
        "Se voce nao solicitou a troca de senha, ignore este e-mail. Sua senha atual continua valida."
    )
    subject = "[Hope Desk] Troca de senha"
    return send_email([user.email], subject, body)


def validate_new_password(password: str, confirmation: str) -> str | None:
    if not password or not confirmation:
        return "Preencha a nova senha e a confirmação."
    if len(password) < 6:
        return "A nova senha deve ter pelo menos 6 caracteres."
    if password != confirmation:
        return "A confirmação não confere com a nova senha."
    return None


def build_ticket_external_url(ticket_id: int) -> str:
    return url_for("ticket_detail", ticket_id=ticket_id, _external=True)


def notify_technicians_new_ticket(ticket: "Ticket") -> bool:
    recipients: list[str] = []

    # Quando o chamado possui técnico designado, notifica apenas esse técnico.
    if ticket.technician_id:
        assigned_tech = User.query.filter_by(id=ticket.technician_id, role="technician").first()
        if assigned_tech and assigned_tech.email:
            recipients = [assigned_tech.email]
    else:
        # Sem técnico designado: notifica todos os técnicos, exceto superuser.
        technicians = User.query.filter_by(role="technician").all()
        recipients = sorted(
            {user.email for user in technicians if user.email and not user.is_superuser}
        )

    if not recipients:
        return False

    ticket_url = build_ticket_external_url(ticket.id)
    body = (
        "Novo chamado recebido no Hope Desk.\n\n"
        f"Chamado #{ticket.id}\n"
        f"Titulo: {ticket.title}\n"
        f"Cliente: {ticket.client.name}\n"
        f"Descricao:\n{ticket.description}\n\n"
        f"Acesse o chamado diretamente: {ticket_url}"
    )
    subject = f"[Hope Desk] Novo chamado #{ticket.id}: {ticket.title}"
    return send_email(recipients, subject, body)


def notify_client_status_changed(ticket: "Ticket", old_status: str, new_status: str) -> bool:
    if not ticket.client or not ticket.client.email:
        return False

    ticket_url = build_ticket_external_url(ticket.id)
    body = (
        "O status do seu chamado foi atualizado.\n\n"
        f"Chamado #{ticket.id}\n"
        f"Titulo: {ticket.title}\n"
        f"Status anterior: {old_status}\n"
        f"Novo status: {new_status}\n\n"
        f"Acesse o chamado diretamente: {ticket_url}"
    )
    subject = f"[Hope Desk] Atualizacao de status do chamado #{ticket.id}"
    return send_email([ticket.client.email], subject, body)


def notify_client_new_activity(ticket: "Ticket", activity: "Activity") -> bool:
    if not ticket.client or not ticket.client.email:
        return False

    technician_name = activity.created_by.name if activity.created_by else "Tecnico"
    ticket_url = build_ticket_external_url(ticket.id)
    body = (
        "Uma nova tarefa/atividade foi registrada no seu chamado.\n\n"
        f"Chamado #{ticket.id}\n"
        f"Titulo: {ticket.title}\n"
        f"Tecnico: {technician_name}\n"
        f"Inicio: {activity.started_at.strftime('%d/%m/%Y %H:%M')}\n"
        f"Fim: {activity.ended_at.strftime('%d/%m/%Y %H:%M')}\n"
        f"Descricao da atividade:\n{activity.notes}\n\n"
        f"Acesse o chamado diretamente: {ticket_url}"
    )
    subject = f"[Hope Desk] Nova tarefa no chamado #{ticket.id}"
    return send_email([ticket.client.email], subject, body)


def find_activity_conflict(
    technician_id: int,
    started_at: datetime,
    ended_at: datetime,
    exclude_activity_id: int | None = None,
) -> Activity | None:
    query = Activity.query.filter(
        Activity.created_by_id == technician_id,
        Activity.started_at < ended_at,
        Activity.ended_at > started_at,
    )
    if exclude_activity_id is not None:
        query = query.filter(Activity.id != exclude_activity_id)
    return query.order_by(Activity.started_at.asc()).first()


def validate_activity_period(started_at: datetime, ended_at: datetime) -> str | None:
    if ended_at <= started_at:
        return "A data/hora de término deve ser posterior à data/hora de início."

    duration_hours = (ended_at - started_at).total_seconds() / 3600
    if duration_hours > 12:
        return "A duração da atividade não pode ser superior a 12 horas."

    return None


@app.route("/")
def home():
    if "user_id" in session:
        return redirect(url_for("analytics_dashboard"))
    return redirect(url_for("login"))


@app.route("/users", methods=["GET", "POST"])
@app.route("/register", methods=["GET", "POST"])
@login_required
@role_required("technician")
def manage_users():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        role = request.form.get("role", "client")
        must_change_password = request.form.get("must_change_password") == "on"

        if role not in {"client", "technician"}:
            flash("Perfil inválido.", "danger")
            return redirect(url_for("manage_users"))

        if not name or not email or not password:
            flash("Preencha todos os campos.", "danger")
            return redirect(url_for("manage_users"))

        if User.query.filter_by(email=email).first():
            flash("E-mail já cadastrado.", "warning")
            return redirect(url_for("manage_users"))

        user = User(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            role=role,
            must_change_password=must_change_password,
        )
        db.session.add(user)
        db.session.commit()
        flash("Usuário cadastrado com sucesso.", "success")
        return redirect(url_for("manage_users"))

    users = User.query.order_by(User.name.asc()).all()
    return render_template("users.html", users=users)


@app.route("/admin/company-parameters", methods=["GET", "POST"])
@login_required
def manage_company_parameters():
    if not session.get("is_superuser", False):
        flash("Apenas superuser pode acessar esta página.", "danger")
        return redirect(url_for("dashboard"))

    ensure_system_parameters()

    if request.method == "POST":
        company_name = request.form.get("company_name", "").strip()
        company_address = request.form.get("company_address", "").strip()
        company_logo = request.form.get("company_logo", "").strip()
        monthly_hours_allowance_raw = request.form.get("monthly_hours_allowance", "").strip()
        hours_bank_closing_date_raw = request.form.get("hours_bank_closing_date", "").strip()

        if not company_name:
            flash("Informe o nome da empresa.", "danger")
            return redirect(url_for("manage_company_parameters"))

        if not company_address:
            flash("Informe o endereço da empresa.", "danger")
            return redirect(url_for("manage_company_parameters"))

        if not monthly_hours_allowance_raw:
            flash("Informe a quantidade de horas de franquia mensal.", "danger")
            return redirect(url_for("manage_company_parameters"))

        normalized_allowance = monthly_hours_allowance_raw.replace(",", ".")
        try:
            monthly_hours_allowance = float(normalized_allowance)
            if monthly_hours_allowance < 0:
                raise ValueError
        except ValueError:
            flash("A franquia mensal deve ser um número válido maior ou igual a zero.", "danger")
            return redirect(url_for("manage_company_parameters"))

        try:
            closing_date = datetime.strptime(hours_bank_closing_date_raw, "%Y-%m-%d").date()
        except ValueError:
            flash("Informe uma data de fechamento do banco de horas válida.", "danger")
            return redirect(url_for("manage_company_parameters"))

        set_system_parameter("company_name", company_name)
        set_system_parameter("company_address", company_address)
        set_system_parameter("company_logo", company_logo)
        set_system_parameter("monthly_hours_allowance", f"{monthly_hours_allowance:.2f}")
        set_system_parameter("hours_bank_closing_date", closing_date.isoformat())
        db.session.commit()
        flash("Parâmetros da empresa atualizados com sucesso.", "success")
        return redirect(url_for("manage_company_parameters"))

    today = datetime.now()
    return render_template(
        "company_parameters.html",
        company_name=get_system_parameter("company_name", "Hope Desk"),
        company_address=get_system_parameter("company_address", "Endereço não informado"),
        company_logo=get_system_parameter("company_logo", ""),
        monthly_hours_allowance=get_system_parameter("monthly_hours_allowance", "16"),
        hours_bank_closing_date=get_system_parameter(
            "hours_bank_closing_date",
            today.replace(month=1, day=1).date().isoformat(),
        ),
    )


@app.route("/admin/system-modules", methods=["GET", "POST"])
@login_required
def manage_system_modules():
    if not session.get("is_superuser", False):
        flash("Apenas superuser pode acessar esta página.", "danger")
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        module_name = request.form.get("name", "").strip()
        if not module_name:
            flash("Informe o nome do módulo.", "danger")
            return redirect(url_for("manage_system_modules"))

        existing = SystemModule.query.filter(db.func.lower(SystemModule.name) == module_name.lower()).first()
        if existing:
            flash("Já existe um módulo com este nome.", "warning")
            return redirect(url_for("manage_system_modules"))

        db.session.add(SystemModule(name=module_name, is_active=True))
        db.session.commit()
        flash("Módulo cadastrado com sucesso.", "success")
        return redirect(url_for("manage_system_modules"))

    modules = SystemModule.query.order_by(SystemModule.name.asc()).all()
    return render_template("system_modules.html", modules=modules)


@app.route("/admin/payments", methods=["GET", "POST"])
@login_required
def manage_payments():
    if not session.get("is_superuser", False):
        flash("Apenas superuser pode acessar esta página.", "danger")
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        paid_at_raw = request.form.get("paid_at", "").strip()
        amount_raw = request.form.get("amount", "").strip().replace(",", ".")
        paid_hours_raw = request.form.get("paid_hours", "").strip().replace(",", ".")

        try:
            paid_at = datetime.strptime(paid_at_raw, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            flash("Informe uma data de pagamento válida.", "danger")
            return redirect(url_for("manage_payments"))

        try:
            amount = float(amount_raw) if amount_raw else 0.0
            if amount < 0:
                raise ValueError
        except ValueError:
            flash("Informe um valor válido para o pagamento.", "danger")
            return redirect(url_for("manage_payments"))

        try:
            paid_hours = float(paid_hours_raw) if paid_hours_raw else 0.0
            if paid_hours < 0:
                raise ValueError
        except ValueError:
            flash("Informe a quantidade de horas pagas de forma válida.", "danger")
            return redirect(url_for("manage_payments"))

        payment = PaymentRecord(paid_at=paid_at, amount=amount, paid_hours=paid_hours)
        db.session.add(payment)
        db.session.commit()
        flash("Pagamento registrado com sucesso.", "success")
        return redirect(url_for("manage_payments"))

    payments = PaymentRecord.query.order_by(PaymentRecord.paid_at.desc(), PaymentRecord.created_at.desc()).all()
    return render_template("payments.html", payments=payments)


@app.route("/admin/payments/<int:payment_id>/delete", methods=["POST"])
@login_required
def delete_payment(payment_id: int):
    if not session.get("is_superuser", False):
        flash("Apenas superuser pode acessar esta página.", "danger")
        return redirect(url_for("dashboard"))

    payment = PaymentRecord.query.get_or_404(payment_id)
    db.session.delete(payment)
    db.session.commit()
    flash("Registro de pagamento excluído com sucesso.", "success")
    return redirect(url_for("manage_payments"))


@app.route("/admin/system-modules/<int:module_id>/toggle", methods=["POST"])
@login_required
def toggle_system_module(module_id: int):
    if not session.get("is_superuser", False):
        flash("Apenas superuser pode acessar esta página.", "danger")
        return redirect(url_for("dashboard"))

    system_module = SystemModule.query.get_or_404(module_id)
    system_module.is_active = not system_module.is_active
    db.session.commit()
    flash("Situação do módulo atualizada.", "success")
    return redirect(url_for("manage_system_modules"))


@app.route("/users/<int:user_id>/edit", methods=["GET", "POST"])
@login_required
@role_required("technician")
def edit_user(user_id: int):
    user = User.query.get_or_404(user_id)

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        role = request.form.get("role", "client")
        password = request.form.get("password", "")

        if role not in {"client", "technician"}:
            flash("Perfil inválido.", "danger")
            return redirect(url_for("edit_user", user_id=user.id))

        if not name or not email:
            flash("Nome e e-mail são obrigatórios.", "danger")
            return redirect(url_for("edit_user", user_id=user.id))

        email_owner = User.query.filter_by(email=email).first()
        if email_owner and email_owner.id != user.id:
            flash("E-mail já cadastrado por outro usuário.", "warning")
            return redirect(url_for("edit_user", user_id=user.id))

        user.name = name
        user.email = email
        user.role = role
        user.must_change_password = request.form.get("must_change_password") == "on"

        if password:
            user.password_hash = generate_password_hash(password)

        db.session.commit()
        flash("Usuário atualizado com sucesso.", "success")
        return redirect(url_for("manage_users"))

    return render_template("edit_user.html", user=user)


@app.route("/users/<int:user_id>/send-reset-link", methods=["POST"])
@login_required
@role_required("technician")
def send_user_reset_link(user_id: int):
    user = User.query.get_or_404(user_id)

    if send_password_reset_email(user):
        flash(f"Link de troca de senha enviado para {user.email}.", "success")
    else:
        flash("Não foi possível enviar o e-mail. Verifique a configuração de SMTP.", "danger")

    return redirect(url_for("manage_users"))


@app.route("/users/<int:user_id>/delete", methods=["POST"])
@login_required
@role_required("technician")
def delete_user(user_id: int):
    user = User.query.get_or_404(user_id)

    if user.id == session.get("user_id"):
        flash("Você não pode excluir o seu próprio usuário.", "danger")
        return redirect(url_for("manage_users"))

    has_tickets = bool(user.client_tickets or user.tech_tickets)
    has_activities = Activity.query.filter_by(created_by_id=user.id).first() is not None
    if has_tickets or has_activities:
        flash("Não é possível excluir este usuário porque ele possui chamados ou atividades vinculadas.", "warning")
        return redirect(url_for("manage_users"))

    db.session.delete(user)
    db.session.commit()
    flash("Usuário excluído com sucesso.", "success")
    return redirect(url_for("manage_users"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            flash("Credenciais inválidas.", "danger")
            return redirect(url_for("login"))

        session["user_id"] = user.id
        session["user_name"] = user.name
        session["role"] = user.role
        session["is_superuser"] = user.is_superuser
        session["must_change_password"] = bool(user.must_change_password)

        if user.must_change_password:
            flash("Você precisa definir uma nova senha antes de continuar.", "warning")
            return redirect(url_for("change_password"))

        flash("Login realizado com sucesso.", "success")
        return redirect(url_for("analytics_dashboard"))

    return render_template("login.html")


@app.route("/logout")
@login_required
def logout():
    session.clear()
    flash("Sessão encerrada.", "info")
    return redirect(url_for("login"))


@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        if not email:
            flash("Informe o e-mail cadastrado.", "danger")
            return redirect(url_for("forgot_password"))

        user = User.query.filter_by(email=email).first()
        if user:
            send_password_reset_email(user)

        # Mensagem genérica para não revelar quais e-mails existem no sistema.
        flash("Se o e-mail estiver cadastrado, você receberá um link para troca de senha.", "info")
        return redirect(url_for("login"))

    return render_template("forgot_password.html")


@app.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token: str):
    user = find_user_by_reset_token(token)
    if not user:
        flash("Link de troca de senha inválido ou expirado. Solicite um novo link.", "danger")
        return redirect(url_for("forgot_password"))

    if request.method == "POST":
        password = request.form.get("password", "")
        confirmation = request.form.get("password_confirmation", "")

        error = validate_new_password(password, confirmation)
        if error:
            flash(error, "danger")
            return redirect(url_for("reset_password", token=token))

        user.password_hash = generate_password_hash(password)
        user.reset_token_hash = None
        user.reset_token_expires_at = None
        user.must_change_password = False
        db.session.commit()

        flash("Senha alterada com sucesso. Faça login com a nova senha.", "success")
        return redirect(url_for("login"))

    return render_template("reset_password.html", token=token, user_email=user.email)


@app.route("/change-password", methods=["GET", "POST"])
@login_required
def change_password():
    user = db.session.get(User, session["user_id"])
    if not user:
        session.clear()
        flash("Faça login para continuar.", "warning")
        return redirect(url_for("login"))

    if request.method == "POST":
        current_password = request.form.get("current_password", "")
        password = request.form.get("password", "")
        confirmation = request.form.get("password_confirmation", "")

        if not check_password_hash(user.password_hash, current_password):
            flash("Senha atual incorreta.", "danger")
            return redirect(url_for("change_password"))

        error = validate_new_password(password, confirmation)
        if error:
            flash(error, "danger")
            return redirect(url_for("change_password"))

        user.password_hash = generate_password_hash(password)
        user.must_change_password = False
        user.reset_token_hash = None
        user.reset_token_expires_at = None
        db.session.commit()
        session["must_change_password"] = False

        flash("Senha alterada com sucesso.", "success")
        return redirect(url_for("dashboard"))

    return render_template(
        "change_password.html",
        forced=session.get("must_change_password", False),
    )


MONTHS_PT = [
    (1, "Janeiro"),
    (2, "Fevereiro"),
    (3, "Março"),
    (4, "Abril"),
    (5, "Maio"),
    (6, "Junho"),
    (7, "Julho"),
    (8, "Agosto"),
    (9, "Setembro"),
    (10, "Outubro"),
    (11, "Novembro"),
    (12, "Dezembro"),
]

ANALYTICS_STATUS_META = {
    "aberto": {"label": "Em aberto", "color": "#d92120"},
    "em_andamento": {"label": "Em andamento", "color": "#ffcc00"},
    "resolvido": {"label": "Concluído", "color": "#1f9d55"},
    "fechado": {"label": "Fechado", "color": "#234783"},
}


def clip_hours(activity: Activity, window_start: datetime, window_end: datetime) -> tuple[datetime, float]:
    overlap_start = max(activity.started_at, window_start)
    overlap_end = min(activity.ended_at, window_end)
    hours = max((overlap_end - overlap_start).total_seconds() / 3600, 0)
    return overlap_start, hours


@app.route("/analytics")
@login_required
def analytics_dashboard():
    user_id = session["user_id"]
    role = session["role"]
    today = datetime.now()

    # Mês e ano podem ficar em branco: sem mês = visão anual; sem ano = todo o período.
    month_raw = request.args.get("month")
    year_raw = request.args.get("year")
    if month_raw is None and year_raw is None:
        selected_year: int | None = today.year
        selected_month: int | None = today.month
    else:
        try:
            selected_year = int(year_raw) if year_raw else None
        except (TypeError, ValueError):
            selected_year = today.year
        try:
            selected_month = int(month_raw) if month_raw else None
        except (TypeError, ValueError):
            selected_month = None
        if selected_month is not None and not 1 <= selected_month <= 12:
            selected_month = None
        if selected_year is None:
            selected_month = None

    if role == "client":
        ticket_scope = Ticket.query.filter_by(client_id=user_id)
    else:
        ticket_scope = Ticket.query

    if selected_year is None:
        earliest_ticket = ticket_scope.order_by(Ticket.created_at.asc()).first()
        if earliest_ticket:
            period_start = datetime(earliest_ticket.created_at.year, earliest_ticket.created_at.month, 1)
        else:
            period_start = datetime(today.year, 1, 1)
        period_end = month_period_bounds(today.year, today.month)[1]
    elif selected_month is None:
        period_start = datetime(selected_year, 1, 1)
        period_end = datetime(selected_year + 1, 1, 1)
    else:
        period_start, period_end = month_period_bounds(selected_year, selected_month)

    month_names = dict(MONTHS_PT)
    month_short_names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    if selected_month is not None:
        bucket_mode = "day"
        buckets = [
            {"key": day, "label": str(day)}
            for day in range(1, calendar.monthrange(selected_year, selected_month)[1] + 1)
        ]

        def bucket_of(moment: datetime):
            return moment.day

        period_label = f"Visão de {month_names[selected_month]} de {selected_year}"
        activity_chart_title = f"Atividade diária em {month_names[selected_month]}/{selected_year}"
        period_foot = f"abertos em {month_names[selected_month].lower()}"
    else:
        bucket_mode = "month"
        buckets = []
        cursor = period_start
        while cursor < period_end:
            label = month_short_names[cursor.month - 1]
            if selected_year is None:
                label = f"{label}/{str(cursor.year)[2:]}"
            buckets.append({"key": f"{cursor.year}-{cursor.month:02d}", "label": label})
            cursor = add_months(cursor, 1)

        def bucket_of(moment: datetime):
            return f"{moment.year}-{moment.month:02d}"

        if selected_year is not None:
            period_label = f"Visão do ano de {selected_year}"
            activity_chart_title = f"Atividade mensal em {selected_year}"
            period_foot = f"abertos em {selected_year}"
        else:
            period_label = "Visão de todo o período"
            activity_chart_title = "Atividade mensal — todo o período"
            period_foot = "no período completo"

    year_expr = db.extract("year", Ticket.created_at)
    year_rows = (
        ticket_scope.with_entities(year_expr.label("year"))
        .distinct()
        .order_by(year_expr.desc())
        .all()
    )
    available_years = [int(year_row[0]) for year_row in year_rows if year_row[0] is not None]
    if today.year not in available_years:
        available_years.insert(0, today.year)

    period_tickets = (
        ticket_scope.filter(Ticket.created_at >= period_start, Ticket.created_at < period_end)
        .order_by(Ticket.created_at.desc())
        .all()
    )

    activity_scope = Activity.query.join(Ticket, Activity.ticket_id == Ticket.id).filter(
        Activity.ended_at > period_start,
        Activity.started_at < period_end,
    )
    if role == "client":
        activity_scope = activity_scope.filter(Ticket.client_id == user_id)
    period_activities = activity_scope.all()

    activities_data: list[dict] = []
    ticket_activity_techs: dict[int, set[str]] = defaultdict(set)
    for activity in period_activities:
        ticket = activity.ticket
        if not ticket:
            continue
        overlap_start, hours = clip_hours(activity, period_start, period_end)
        if hours <= 0:
            continue
        tech_name = activity.created_by.name if activity.created_by else "Técnico não informado"
        ticket_activity_techs[ticket.id].add(tech_name)
        activities_data.append(
            {
                "ticket_id": ticket.id,
                "bucket": bucket_of(overlap_start),
                "tech": tech_name,
                "hours": round(hours, 2),
                "status": ticket.status,
                "module": ticket.system_module.name if ticket.system_module else "Sem módulo",
                "client": ticket.client.name if ticket.client else "-",
            }
        )

    tickets_data: list[dict] = []
    for ticket in period_tickets:
        first_activity = min(ticket.activities, key=lambda item: item.started_at) if ticket.activities else None
        response_hours = None
        if first_activity:
            response_hours = round(
                max((first_activity.started_at - ticket.created_at).total_seconds() / 3600, 0), 2
            )

        techs = set(ticket_activity_techs.get(ticket.id, set()))
        if ticket.technician:
            techs.add(ticket.technician.name)

        is_concluded = ticket.status in {"resolvido", "fechado"}
        tickets_data.append(
            {
                "id": ticket.id,
                "title": ticket.title,
                "status": ticket.status,
                "module": ticket.system_module.name if ticket.system_module else "Sem módulo",
                "client": ticket.client.name if ticket.client else "-",
                "tech": ticket.technician.name if ticket.technician else "-",
                "techs": sorted(techs),
                "bucket": bucket_of(ticket.created_at),
                "created_label": ticket.created_at.strftime("%d/%m/%Y %H:%M"),
                "hours": ticket.total_hours,
                "response_hours": response_hours,
                "age_days": None if is_concluded else max((today - ticket.created_at).days, 0),
            }
        )

    # Tendência dos últimos 12 meses encerrando no período selecionado.
    trend_anchor_source = period_end - timedelta(seconds=1)
    trend_start = add_months(datetime(trend_anchor_source.year, trend_anchor_source.month, 1), -11)
    trend_counts: dict[tuple[int, int], int] = defaultdict(int)
    trend_ticket_rows = ticket_scope.filter(
        Ticket.created_at >= trend_start, Ticket.created_at < period_end
    ).all()
    for ticket in trend_ticket_rows:
        trend_counts[(ticket.created_at.year, ticket.created_at.month)] += 1

    trend_hours: dict[tuple[int, int], float] = defaultdict(float)
    trend_activity_scope = Activity.query.join(Ticket, Activity.ticket_id == Ticket.id).filter(
        Activity.ended_at > trend_start,
        Activity.started_at < period_end,
    )
    if role == "client":
        trend_activity_scope = trend_activity_scope.filter(Ticket.client_id == user_id)
    for activity in trend_activity_scope.all():
        overlap_start = max(activity.started_at, trend_start)
        overlap_end = min(activity.ended_at, period_end)
        cursor = overlap_start
        while cursor < overlap_end:
            month_end = month_period_bounds(cursor.year, cursor.month)[1]
            segment_end = min(overlap_end, month_end)
            trend_hours[(cursor.year, cursor.month)] += (segment_end - cursor).total_seconds() / 3600
            cursor = segment_end

    trend_data: list[dict] = []
    for offset in range(12):
        month_ref = add_months(trend_start, offset)
        key = (month_ref.year, month_ref.month)
        trend_data.append(
            {
                "label": f"{month_ref.month:02d}/{str(month_ref.year)[2:]}",
                "year": month_ref.year,
                "month": month_ref.month,
                "tickets": trend_counts.get(key, 0),
                "hours": round(trend_hours.get(key, 0.0), 2),
            }
        )

    backlog_query = ticket_scope.filter(Ticket.status.in_(["aberto", "em_andamento"]))
    backlog_total = backlog_query.count()
    oldest_open = backlog_query.order_by(Ticket.created_at.asc()).first()
    backlog_oldest_days = max((today - oldest_open.created_at).days, 0) if oldest_open else 0

    accumulated_hours_total, _paid_cycle, monthly_hours_allowance, cycle_start, cycle_end = calculate_accumulated_hours(
        user_id=user_id,
        role=role,
        reference=today,
    )
    if selected_year is None:
        paid_scope = PaymentRecord.query
    else:
        paid_scope = PaymentRecord.query.filter(
            PaymentRecord.paid_at >= period_start.date(),
            PaymentRecord.paid_at < period_end.date(),
        )
    paid_hours_period_total = round(sum(payment.paid_hours for payment in paid_scope.all()), 2)

    return render_template(
        "analytics.html",
        role=role,
        months=MONTHS_PT,
        selected_month=selected_month,
        selected_year=selected_year,
        available_years=available_years,
        period_label=period_label,
        activity_chart_title=activity_chart_title,
        period_foot=period_foot,
        buckets=buckets,
        bucket_mode=bucket_mode,
        tickets_data=tickets_data,
        activities_data=activities_data,
        trend_data=trend_data,
        status_meta=ANALYTICS_STATUS_META,
        backlog_total=backlog_total,
        backlog_oldest_days=backlog_oldest_days,
        accumulated_hours_total=accumulated_hours_total,
        monthly_hours_allowance=monthly_hours_allowance,
        paid_hours_total=paid_hours_period_total,
        cycle_start_label=cycle_start.strftime("%d/%m/%Y"),
        cycle_end_label=cycle_end.strftime("%d/%m/%Y"),
    )


@app.route("/dashboard")
@login_required
def dashboard():
    user_id = session["user_id"]
    role = session["role"]
    today = datetime.now()
    selected_year, selected_month = resolve_period(
        request.args.get("year", str(today.year)),
        request.args.get("month", str(today.month)),
    )
    selected_status = (request.args.get("status", "nao_concluidos") or "nao_concluidos").strip().lower()
    valid_status_filters = {"nao_concluidos", "all", "aberto", "em_andamento", "resolvido", "fechado"}
    if selected_status not in valid_status_filters:
        selected_status = "nao_concluidos"

    if role == "client":
        scope_query = Ticket.query.filter_by(client_id=user_id)
    else:
        scope_query = Ticket.query

    year_expr = db.extract("year", Ticket.created_at)
    month_expr = db.extract("month", Ticket.created_at)

    year_rows = (
        scope_query.with_entities(year_expr.label("year"))
        .distinct()
        .order_by(year_expr.desc())
        .all()
    )
    available_years = [int(year_row[0]) for year_row in year_rows if year_row[0] is not None]
    if today.year not in available_years:
        available_years.insert(0, today.year)

    period_scope_query = scope_query.filter(year_expr == selected_year, month_expr == selected_month)
    total_hours_sum = round(sum(ticket.total_hours for ticket in period_scope_query.all()), 2)
    external_ticket_activity_hours = calculate_external_ticket_activity_hours(
        selected_year=selected_year,
        selected_month=selected_month,
        user_id=user_id,
        role=role,
    )

    tickets_query = period_scope_query
    if selected_status == "nao_concluidos":
        tickets_query = tickets_query.filter(~Ticket.status.in_(["resolvido", "fechado"]))
    elif selected_status != "all":
        tickets_query = tickets_query.filter(Ticket.status == selected_status)

    tickets = tickets_query.order_by(Ticket.created_at.desc()).all()
    tickets_hours_sum = round(sum(ticket.total_hours for ticket in tickets), 2)
    accumulated_hours_total, _paid_hours_cycle_total, monthly_hours_allowance, cycle_start, cycle_end = calculate_accumulated_hours(
        user_id=user_id,
        role=role,
        reference=today,
    )
    paid_hours_period_total = calculate_paid_hours_for_month(selected_year, selected_month)

    months = [
        (1, "Janeiro"),
        (2, "Fevereiro"),
        (3, "Março"),
        (4, "Abril"),
        (5, "Maio"),
        (6, "Junho"),
        (7, "Julho"),
        (8, "Agosto"),
        (9, "Setembro"),
        (10, "Outubro"),
        (11, "Novembro"),
        (12, "Dezembro"),
    ]

    status_meta = {
        "aberto": {"label": "Em aberto", "class": "status-open"},
        "em_andamento": {"label": "Em andamento", "class": "status-progress"},
        "resolvido": {"label": "Concluído", "class": "status-done"},
        "fechado": {"label": "Fechado", "class": "status-done"},
    }
    status_filters = [
        ("nao_concluidos", "Não concluídos"),
        ("all", "Todos"),
        ("aberto", "Em aberto"),
        ("em_andamento", "Em andamento"),
        ("resolvido", "Concluído"),
        ("fechado", "Fechado"),
    ]

    return render_template(
        "dashboard.html",
        tickets=tickets,
        tickets_hours_sum=tickets_hours_sum,
        role=role,
        months=months,
        selected_month=selected_month,
        available_years=available_years,
        selected_year=selected_year,
        selected_status=selected_status,
        status_filters=status_filters,
        status_meta=status_meta,
        total_hours_sum=total_hours_sum,
        external_ticket_activity_hours=external_ticket_activity_hours,
        accumulated_hours_total=accumulated_hours_total,
        paid_hours_total=paid_hours_period_total,
        monthly_hours_allowance=monthly_hours_allowance,
        cycle_start_label=cycle_start.strftime("%d/%m/%Y"),
        cycle_end_label=cycle_end.strftime("%d/%m/%Y"),
    )


@app.route("/reports/activities")
@login_required
def activities_report():
    period_start, period_end, start_value, end_value = resolve_date_period(
        request.args.get("start_date"),
        request.args.get("end_date"),
    )
    tickets, totals_by_technician, total_hours = build_activity_report(
        period_start=period_start,
        period_end=period_end,
        user_id=session["user_id"],
        role=session["role"],
    )

    return render_template(
        "activities_report.html",
        tickets=tickets,
        totals_by_technician=totals_by_technician,
        total_hours=total_hours,
        start_date=start_value,
        end_date=end_value,
        period_start_label=period_start.strftime("%d/%m/%Y"),
        period_end_label=(period_end - timedelta(days=1)).strftime("%d/%m/%Y"),
    )


@app.route("/reports/activities.pdf")
@login_required
def export_activities_report_pdf():
    period_start, period_end, start_value, end_value = resolve_date_period(
        request.args.get("start_date"),
        request.args.get("end_date"),
    )
    tickets, totals_by_technician, total_hours = build_activity_report(
        period_start=period_start,
        period_end=period_end,
        user_id=session["user_id"],
        role=session["role"],
    )

    company_logo = get_system_parameter("company_logo")
    company_name = get_system_parameter("company_name", "Hope Desk")
    company_address = get_system_parameter("company_address", "Endereço não informado")

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        topMargin=7 * mm,
        leftMargin=7 * mm,
        rightMargin=7 * mm,
        bottomMargin=7 * mm,
    )
    styles = getSampleStyleSheet()
    elements: list = []

    logo = try_build_logo(company_logo)
    company_text = [
        Paragraph(f"<b>{escape(company_name)}</b>", styles["Title"]),
        Spacer(1, 3),
        Paragraph(escape(company_address), styles["Normal"]),
    ]
    header_table = Table([[logo if logo else "", company_text]], colWidths=[40 * mm, doc.width - (40 * mm)])
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    elements.append(header_table)
    elements.append(Spacer(1, 10))
    elements.append(
        Paragraph(
            (
                "<b>RELATÓRIO DE ATIVIDADES REALIZADAS</b><br/>"
                f"Período: {period_start.strftime('%d/%m/%Y')} até "
                f"{(period_end - timedelta(days=1)).strftime('%d/%m/%Y')}"
            ),
            styles["Heading3"],
        )
    )
    elements.append(Spacer(1, 8))

    if tickets:
        for ticket in tickets:
            ticket_title = (
                f"<b>Chamado #{ticket['ticket_id']} - {escape(ticket['title'])}</b><br/>"
                f"Status: {escape(ticket['status'])} | Cliente: {escape(ticket['client_name'])} | "
                f"Técnico responsável: {escape(ticket['assigned_technician'])} | "
                f"Módulo: {escape(ticket['module_name'])} | "
                f"Abertura: {ticket['created_at'].strftime('%d/%m/%Y %H:%M')} | "
                f"Total no período: {ticket['total_hours']:.2f} h"
            )
            elements.append(Paragraph(ticket_title, styles["Heading4"]))
            elements.append(Spacer(1, 4))

            table_data = [["Início", "Fim", "Técnico", "Atividade", "Horas"]]
            for activity in ticket["activities"]:
                table_data.append(
                    [
                        activity["started_at"].strftime("%d/%m/%Y %H:%M"),
                        activity["ended_at"].strftime("%d/%m/%Y %H:%M"),
                        activity["technician_name"],
                        Paragraph(escape(activity["notes"]), styles["BodyText"]),
                        f"{activity['hours']:.2f}",
                    ]
                )

            activity_table = Table(
                table_data,
                repeatRows=1,
                colWidths=[31 * mm, 31 * mm, 42 * mm, 146 * mm, 18 * mm],
            )
            activity_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#9ca3af")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("ALIGN", (0, 0), (1, -1), "CENTER"),
                        ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            elements.append(activity_table)
            elements.append(Spacer(1, 8))
    else:
        elements.append(Paragraph("Nenhuma atividade realizada no período selecionado.", styles["Normal"]))
        elements.append(Spacer(1, 8))

    totals_data = [["Técnico", "Total de horas"]]
    for row in totals_by_technician:
        totals_data.append([row["technician_name"], f"{row['hours']:.2f}"])
    totals_data.append(["TOTAL GERAL", f"{total_hours:.2f}"])

    totals_table = Table(totals_data, colWidths=[80 * mm, 35 * mm])
    totals_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#234783")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#9ca3af")),
                ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(Paragraph("<b>Totalizador por técnico</b>", styles["Heading4"]))
    elements.append(totals_table)

    doc.build(elements)
    buffer.seek(0)

    file_name = f"relatorio_atividades_{start_value}_a_{end_value}.pdf"
    return send_file(
        buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=file_name,
    )


@app.route("/reports/services.pdf")
@login_required
def export_services_report_pdf():
    selected_year, selected_month = resolve_period(
        request.args.get("year"),
        request.args.get("month"),
    )
    user_id = session["user_id"]
    role = session["role"]
    rows, total_hours = build_services_report_rows(selected_year, selected_month, user_id, role)
    reference = datetime.now()
    accumulated_hours_total, _paid_hours_cycle_total, monthly_hours_allowance, cycle_start, cycle_end = calculate_accumulated_hours(
        user_id=user_id,
        role=role,
        reference=reference,
    )
    paid_hours_period_total = calculate_paid_hours_for_month(selected_year, selected_month)

    company_logo = get_system_parameter("company_logo")
    company_name = get_system_parameter("company_name", "Hope Desk")
    company_address = get_system_parameter("company_address", "Endereço não informado")

    months = {
        1: "JANEIRO",
        2: "FEVEREIRO",
        3: "MARÇO",
        4: "ABRIL",
        5: "MAIO",
        6: "JUNHO",
        7: "JULHO",
        8: "AGOSTO",
        9: "SETEMBRO",
        10: "OUTUBRO",
        11: "NOVEMBRO",
        12: "DEZEMBRO",
    }
    reference_month = months.get(selected_month, str(selected_month))

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=7 * mm,
        leftMargin=7 * mm,
        rightMargin=7 * mm,
        bottomMargin=7 * mm,
    )
    styles = getSampleStyleSheet()
    elements: list = []

    logo = try_build_logo(company_logo)
    company_text = [
        Paragraph(f"<b>{company_name}</b>", styles["Title"]),
        Spacer(1, 3),
        Paragraph(company_address, styles["Normal"]),
    ]

    header_table = Table(
        [[logo if logo else "", company_text]],
        colWidths=[40 * mm, 145 * mm],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    elements.append(header_table)
    elements.append(Spacer(1, 10))

    title = f"DEMONSTRATIVO DE SERVIÇOS REALIZADOS NO MÊS {reference_month}/{selected_year}"
    elements.append(Paragraph(f"<b>{title}</b>", styles["Heading3"]))
    elements.append(Spacer(1, 8))

    table_data = [[
        "ID",
        "Data",
        "Serviço realizado",
        "Status",
        "Solicitante",
        "Técnico",
        "Qtd. Horas",
    ]]

    for row in rows:
        service_text = f"Chamado: {row['title']}\n\n{row['service']}"
        table_data.append(
            [
                f"#{row['ticket_id']}",
                row["last_activity_at"].strftime("%d/%m/%Y %H:%M"),
                Paragraph(escape(service_text).replace("\n", "<br/>"), styles["BodyText"]),
                row["status"],
                row["client_name"],
                row["technician_name"],
                f"{row['hours']:.2f}",
            ]
        )

    if not rows:
        table_data.append(
            [
                "-",
                "-",
                "Nenhum chamado com tarefas realizadas no período selecionado.",
                "-",
                "-",
                "-",
                "0.00",
            ]
        )

    base_col_widths_mm = [18, 24, 58, 30, 32, 30, 14]
    width_scale = doc.width / sum(width * mm for width in base_col_widths_mm)
    col_widths = [(width * mm) * width_scale for width in base_col_widths_mm]

    report_table = Table(
        table_data,
        repeatRows=1,
        colWidths=col_widths,
    )
    report_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#9ca3af")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (1, -1), "CENTER"),
                ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(report_table)
    elements.append(Spacer(1, 10))
    elements.append(
        Paragraph(
            (
                f"<b>Totais de horas no período:</b> {total_hours:.2f}<br/>"
                f"<b>Horas pagas no período selecionado:</b> {paid_hours_period_total:.2f} h<br/>"
                f"<b>Total acumulado no banco de horas:</b> {accumulated_hours_total:.2f} h "
                f"(franquia mensal: {monthly_hours_allowance:.2f} h)<br/>"
                f"<b>Ciclo do banco de horas:</b> {cycle_start.strftime('%d/%m/%Y')} "
                f"até {cycle_end.strftime('%d/%m/%Y')}"
            ),
            styles["Heading4"],
        )
    )

    doc.build(elements)
    buffer.seek(0)

    file_name = f"demonstrativo_servicos_{selected_year}_{selected_month:02d}.pdf"
    return send_file(
        buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=file_name,
    )


@app.route("/tickets/new", methods=["GET", "POST"])
@login_required
def new_ticket():
    technicians = User.query.filter_by(role="technician").all()
    clients = User.query.filter_by(role="client").order_by(User.name.asc()).all()
    system_modules = SystemModule.query.filter_by(is_active=True).order_by(SystemModule.name.asc()).all()
    role = session.get("role")
    is_super = session.get("is_superuser", False)
    can_create_for_client = role == "technician" or is_super

    if request.method == "POST":
        title = request.form.get("title", "").strip()
        description = request.form.get("description", "").strip()
        technician_id = request.form.get("technician_id")
        client_id_raw = request.form.get("client_id")
        system_module_id_raw = request.form.get("system_module_id", "").strip()

        if not title or not description:
            flash("Titulo e descricao sao obrigatorios.", "danger")
            return redirect(url_for("new_ticket"))

        if not system_module_id_raw:
            flash("Selecione o módulo do sistema.", "danger")
            return redirect(url_for("new_ticket"))

        try:
            system_module_id = int(system_module_id_raw)
        except (TypeError, ValueError):
            flash("Módulo inválido.", "danger")
            return redirect(url_for("new_ticket"))

        system_module = SystemModule.query.filter_by(id=system_module_id, is_active=True).first()
        if not system_module:
            flash("Módulo inválido.", "danger")
            return redirect(url_for("new_ticket"))

        if can_create_for_client:
            if not client_id_raw:
                flash("Selecione um cliente para abrir o chamado.", "danger")
                return redirect(url_for("new_ticket"))
            try:
                client_id = int(client_id_raw)
            except (TypeError, ValueError):
                flash("Cliente invalido.", "danger")
                return redirect(url_for("new_ticket"))

            client = User.query.filter_by(id=client_id, role="client").first()
            if not client:
                flash("Cliente invalido.", "danger")
                return redirect(url_for("new_ticket"))
        else:
            client_id = session["user_id"]

        technician_assigned_id = None
        if technician_id:
            try:
                technician_assigned_id = int(technician_id)
            except (TypeError, ValueError):
                flash("Tecnico invalido.", "danger")
                return redirect(url_for("new_ticket"))

            technician_exists = User.query.filter_by(id=technician_assigned_id, role="technician").first()
            if not technician_exists:
                flash("Tecnico invalido.", "danger")
                return redirect(url_for("new_ticket"))

        ticket = Ticket(
            title=title,
            description=description,
            client_id=client_id,
            technician_id=technician_assigned_id,
            system_module_id=system_module.id,
        )
        db.session.add(ticket)
        db.session.commit()
        notify_technicians_new_ticket(ticket)
        flash("Chamado criado com sucesso.", "success")
        return redirect(url_for("dashboard"))

    return render_template(
        "new_ticket.html",
        technicians=technicians,
        clients=clients,
        system_modules=system_modules,
        can_create_for_client=can_create_for_client,
    )


@app.route("/tickets/<int:ticket_id>/edit", methods=["GET", "POST"])
@login_required
@role_required("technician")
def edit_ticket(ticket_id: int):
    ticket = Ticket.query.get_or_404(ticket_id)
    technicians = User.query.filter_by(role="technician").order_by(User.name.asc()).all()
    clients = User.query.filter_by(role="client").order_by(User.name.asc()).all()
    system_modules = SystemModule.query.order_by(SystemModule.name.asc()).all()
    valid_status = {"aberto", "em_andamento", "resolvido", "fechado"}

    if request.method == "POST":
        title = request.form.get("title", "").strip()
        description = request.form.get("description", "").strip()
        status = request.form.get("status", "").strip()
        client_id_raw = request.form.get("client_id", "").strip()
        technician_id_raw = request.form.get("technician_id", "").strip()
        system_module_id_raw = request.form.get("system_module_id", "").strip()

        if not title or not description:
            flash("Titulo e descricao sao obrigatorios.", "danger")
            return redirect(url_for("edit_ticket", ticket_id=ticket.id))

        if status not in valid_status:
            flash("Status invalido.", "danger")
            return redirect(url_for("edit_ticket", ticket_id=ticket.id))

        try:
            client_id = int(client_id_raw)
        except (TypeError, ValueError):
            flash("Cliente invalido.", "danger")
            return redirect(url_for("edit_ticket", ticket_id=ticket.id))

        client = User.query.filter_by(id=client_id, role="client").first()
        if not client:
            flash("Cliente invalido.", "danger")
            return redirect(url_for("edit_ticket", ticket_id=ticket.id))

        if not system_module_id_raw:
            flash("Selecione o módulo do sistema.", "danger")
            return redirect(url_for("edit_ticket", ticket_id=ticket.id))
        try:
            system_module_id = int(system_module_id_raw)
        except (TypeError, ValueError):
            flash("Módulo inválido.", "danger")
            return redirect(url_for("edit_ticket", ticket_id=ticket.id))

        system_module = SystemModule.query.filter_by(id=system_module_id).first()
        if not system_module:
            flash("Módulo inválido.", "danger")
            return redirect(url_for("edit_ticket", ticket_id=ticket.id))

        technician_id = None
        if technician_id_raw:
            try:
                technician_id = int(technician_id_raw)
            except (TypeError, ValueError):
                flash("Tecnico invalido.", "danger")
                return redirect(url_for("edit_ticket", ticket_id=ticket.id))

            technician_exists = User.query.filter_by(id=technician_id, role="technician").first()
            if not technician_exists:
                flash("Tecnico invalido.", "danger")
                return redirect(url_for("edit_ticket", ticket_id=ticket.id))

        old_status = ticket.status
        ticket.title = title
        ticket.description = description
        ticket.status = status
        ticket.client_id = client_id
        ticket.technician_id = technician_id
        ticket.system_module_id = system_module.id
        db.session.commit()

        if old_status != status:
            notify_client_status_changed(ticket, old_status, status)

        flash("Chamado atualizado com sucesso.", "success")
        return redirect(url_for("ticket_detail", ticket_id=ticket.id))

    return render_template(
        "edit_ticket.html",
        ticket=ticket,
        technicians=technicians,
        clients=clients,
        system_modules=system_modules,
    )


@app.route("/tickets/<int:ticket_id>", methods=["GET", "POST"])
@login_required
def ticket_detail(ticket_id: int):
    ticket = Ticket.query.get_or_404(ticket_id)
    role = session["role"]
    activity_form = {
        "notes": "",
        "started_at": "",
        "ended_at": "",
    }

    def render_detail():
        return render_template(
            "ticket_detail.html",
            ticket=ticket,
            role=role,
            activity_form=activity_form,
        )

    if role == "client" and ticket.client_id != session["user_id"]:
        flash("Chamado não encontrado.", "danger")
        return redirect(url_for("dashboard"))

    if request.method == "POST" and role == "technician":
        action = request.form.get("action")
        if action == "status":
            new_status = request.form.get("status", "").strip()
            valid = {"aberto", "em_andamento", "resolvido", "fechado"}
            if new_status not in valid:
                flash("Status inválido.", "danger")
            else:
                old_status = ticket.status
                ticket.status = new_status
                db.session.commit()
                if old_status != new_status:
                    notify_client_status_changed(ticket, old_status, new_status)
                flash("Status atualizado.", "success")

        elif action == "activity":
            notes = request.form.get("notes", "").strip()
            started_at_raw = request.form.get("started_at", "")
            ended_at_raw = request.form.get("ended_at", "")
            activity_form = {
                "notes": notes,
                "started_at": started_at_raw,
                "ended_at": ended_at_raw,
            }

            try:
                started_at = datetime.fromisoformat(started_at_raw)
                ended_at = datetime.fromisoformat(ended_at_raw)
            except ValueError:
                flash("Datas inválidas. Use data e hora válidas.", "danger")
                return render_detail()

            period_error = validate_activity_period(started_at, ended_at)
            if period_error:
                flash(period_error, "danger")
                return render_detail()

            if not notes:
                flash("Descreva a atividade.", "danger")
                return render_detail()

            conflict = find_activity_conflict(
                technician_id=session["user_id"],
                started_at=started_at,
                ended_at=ended_at,
            )
            if conflict:
                flash(
                    "Conflito de horário: já existe uma atividade sua nesse período "
                    f"({conflict.started_at.strftime('%d/%m/%Y %H:%M')} "
                    f"até {conflict.ended_at.strftime('%d/%m/%Y %H:%M')}).",
                    "danger",
                )
                return render_detail()

            activity = Activity(
                ticket_id=ticket.id,
                notes=notes,
                started_at=started_at,
                ended_at=ended_at,
                created_by_id=session["user_id"],
            )
            db.session.add(activity)
            db.session.commit()
            notify_client_new_activity(ticket, activity)
            flash("Atividade registrada.", "success")

        return redirect(url_for("ticket_detail", ticket_id=ticket.id))

    return render_detail()


@app.route("/tickets/<int:ticket_id>/delete", methods=["POST"])
@login_required
@role_required("technician")
def delete_ticket(ticket_id: int):
    ticket = Ticket.query.get_or_404(ticket_id)
    is_super = session.get("is_superuser", False)

    if not can_delete_by_month(ticket.created_at, is_super):
        flash(
            "Somente chamados do mês corrente podem ser excluídos. "
            "Para meses anteriores, apenas superuser pode excluir.",
            "danger",
        )
        return redirect(url_for("dashboard"))

    db.session.delete(ticket)
    db.session.commit()
    flash("Chamado excluído com sucesso.", "success")
    return redirect(url_for("dashboard"))


@app.route("/tickets/<int:ticket_id>/activities/<int:activity_id>/delete", methods=["POST"])
@login_required
@role_required("technician")
def delete_activity(ticket_id: int, activity_id: int):
    ticket = Ticket.query.get_or_404(ticket_id)
    activity = Activity.query.filter_by(id=activity_id, ticket_id=ticket.id).first_or_404()
    is_super = session.get("is_superuser", False)

    if not can_delete_by_month(activity.started_at, is_super):
        flash(
            "Somente atividades do mês corrente podem ser excluídas. "
            "Para meses anteriores, apenas superuser pode excluir.",
            "danger",
        )
        return redirect(url_for("ticket_detail", ticket_id=ticket.id))

    db.session.delete(activity)
    db.session.commit()
    flash("Atividade excluída com sucesso.", "success")
    return redirect(url_for("ticket_detail", ticket_id=ticket.id))


@app.route("/tickets/<int:ticket_id>/activities/<int:activity_id>/edit", methods=["GET", "POST"])
@login_required
@role_required("technician")
def edit_activity(ticket_id: int, activity_id: int):
    ticket = Ticket.query.get_or_404(ticket_id)
    activity = Activity.query.filter_by(id=activity_id, ticket_id=ticket.id).first_or_404()
    current_user_id = session.get("user_id")
    activity_form = {
        "notes": activity.notes,
        "started_at": activity.started_at.strftime("%Y-%m-%dT%H:%M"),
        "ended_at": activity.ended_at.strftime("%Y-%m-%dT%H:%M"),
    }

    def render_edit_form():
        return render_template(
            "edit_activity.html",
            ticket=ticket,
            activity=activity,
            activity_form=activity_form,
        )

    if activity.created_by_id != current_user_id:
        flash("Você só pode editar atividades lançadas por você.", "danger")
        return redirect(url_for("ticket_detail", ticket_id=ticket.id))

    if request.method == "POST":
        notes = request.form.get("notes", "").strip()
        started_at_raw = request.form.get("started_at", "")
        ended_at_raw = request.form.get("ended_at", "")
        activity_form = {
            "notes": notes,
            "started_at": started_at_raw,
            "ended_at": ended_at_raw,
        }

        try:
            started_at = datetime.fromisoformat(started_at_raw)
            ended_at = datetime.fromisoformat(ended_at_raw)
        except ValueError:
            flash("Datas inválidas. Use data e hora válidas.", "danger")
            return render_edit_form()

        period_error = validate_activity_period(started_at, ended_at)
        if period_error:
            flash(period_error, "danger")
            return render_edit_form()

        if not notes:
            flash("Descreva a atividade.", "danger")
            return render_edit_form()

        conflict = find_activity_conflict(
            technician_id=current_user_id,
            started_at=started_at,
            ended_at=ended_at,
            exclude_activity_id=activity.id,
        )
        if conflict:
            flash(
                "Conflito de horário: já existe uma atividade sua nesse período "
                f"({conflict.started_at.strftime('%d/%m/%Y %H:%M')} "
                f"até {conflict.ended_at.strftime('%d/%m/%Y %H:%M')}).",
                "danger",
            )
            return render_edit_form()

        activity.notes = notes
        activity.started_at = started_at
        activity.ended_at = ended_at
        db.session.commit()
        flash("Atividade atualizada com sucesso.", "success")
        return redirect(url_for("ticket_detail", ticket_id=ticket.id))

    return render_edit_form()


@app.cli.command("init-db")
def init_db() -> None:
    db.create_all()
    ensure_ticket_schema_updates()
    ensure_user_schema_updates()
    ensure_system_parameters()
    result = ensure_superuser()
    print(f"Banco inicializado. {result}")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        ensure_ticket_schema_updates()
        ensure_user_schema_updates()
        ensure_system_parameters()
        print(ensure_superuser())
    app.run(host="0.0.0.0", port=5000, debug=True)

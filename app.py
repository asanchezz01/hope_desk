import calendar
from collections import defaultdict
from datetime import datetime, timedelta
from functools import wraps
from email.message import EmailMessage
import smtplib
import ssl
from io import BytesIO
from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import urlopen

from flask import Flask, flash, redirect, render_template, request, send_file, session, url_for
from flask_sqlalchemy import SQLAlchemy
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
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

    activities = db.relationship("Activity", backref="ticket", lazy=True, cascade="all, delete-orphan")

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


def calculate_accumulated_hours(user_id: int, role: str, reference: datetime) -> tuple[float, float, datetime, datetime]:
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

    return round(accumulated, 2), round(franchise_hours, 2), cycle_start, cycle_end


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
    grouped: dict[int, dict] = {}
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
        row = grouped.get(ticket.id)
        if row is None:
            row = {
                "ticket_id": ticket.id,
                "last_activity_at": activity_end_for_period,
                "title": ticket.title,
                "status": normalize_status(ticket.status),
                "client_name": ticket.client.name if ticket.client else "-",
                "technician_name": ticket.technician.name if ticket.technician else "-",
                "hours": 0.0,
            }
            grouped[ticket.id] = row

        row["hours"] += overlap_hours
        if activity_end_for_period > row["last_activity_at"]:
            row["last_activity_at"] = activity_end_for_period

    report_rows = sorted(grouped.values(), key=lambda item: item["last_activity_at"], reverse=True)
    for row in report_rows:
        row["hours"] = round(row["hours"], 2)
    total_hours = round(sum(row["hours"] for row in report_rows), 2)
    return report_rows, total_hours


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
        return redirect(url_for("dashboard"))
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

        if password:
            user.password_hash = generate_password_hash(password)

        db.session.commit()
        flash("Usuário atualizado com sucesso.", "success")
        return redirect(url_for("manage_users"))

    return render_template("edit_user.html", user=user)


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

        flash("Login realizado com sucesso.", "success")
        return redirect(url_for("dashboard"))

    return render_template("login.html")


@app.route("/logout")
@login_required
def logout():
    session.clear()
    flash("Sessão encerrada.", "info")
    return redirect(url_for("login"))


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

    tickets_query = period_scope_query
    if selected_status == "nao_concluidos":
        tickets_query = tickets_query.filter(~Ticket.status.in_(["resolvido", "fechado"]))
    elif selected_status != "all":
        tickets_query = tickets_query.filter(Ticket.status == selected_status)

    tickets = tickets_query.order_by(Ticket.created_at.desc()).all()
    tickets_hours_sum = round(sum(ticket.total_hours for ticket in tickets), 2)
    accumulated_hours_total, monthly_hours_allowance, cycle_start, cycle_end = calculate_accumulated_hours(
        user_id=user_id,
        role=role,
        reference=today,
    )

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
        accumulated_hours_total=accumulated_hours_total,
        monthly_hours_allowance=monthly_hours_allowance,
        cycle_start_label=cycle_start.strftime("%d/%m/%Y"),
        cycle_end_label=cycle_end.strftime("%d/%m/%Y"),
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
        table_data.append(
            [
                f"#{row['ticket_id']}",
                row["last_activity_at"].strftime("%d/%m/%Y %H:%M"),
                Paragraph(row["title"], styles["BodyText"]),
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
            f"<b>Totais de horas no período:</b> {total_hours:.2f}",
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
    role = session.get("role")
    is_super = session.get("is_superuser", False)
    can_create_for_client = role == "technician" or is_super

    if request.method == "POST":
        title = request.form.get("title", "").strip()
        description = request.form.get("description", "").strip()
        technician_id = request.form.get("technician_id")
        client_id_raw = request.form.get("client_id")

        if not title or not description:
            flash("Titulo e descricao sao obrigatorios.", "danger")
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
        can_create_for_client=can_create_for_client,
    )


@app.route("/tickets/<int:ticket_id>/edit", methods=["GET", "POST"])
@login_required
@role_required("technician")
def edit_ticket(ticket_id: int):
    ticket = Ticket.query.get_or_404(ticket_id)
    technicians = User.query.filter_by(role="technician").order_by(User.name.asc()).all()
    clients = User.query.filter_by(role="client").order_by(User.name.asc()).all()
    valid_status = {"aberto", "em_andamento", "resolvido", "fechado"}

    if request.method == "POST":
        title = request.form.get("title", "").strip()
        description = request.form.get("description", "").strip()
        status = request.form.get("status", "").strip()
        client_id_raw = request.form.get("client_id", "").strip()
        technician_id_raw = request.form.get("technician_id", "").strip()

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
    )


@app.route("/tickets/<int:ticket_id>", methods=["GET", "POST"])
@login_required
def ticket_detail(ticket_id: int):
    ticket = Ticket.query.get_or_404(ticket_id)
    role = session["role"]

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

            try:
                started_at = datetime.fromisoformat(started_at_raw)
                ended_at = datetime.fromisoformat(ended_at_raw)
            except ValueError:
                flash("Datas inválidas. Use data e hora válidas.", "danger")
                return redirect(url_for("ticket_detail", ticket_id=ticket.id))

            period_error = validate_activity_period(started_at, ended_at)
            if period_error:
                flash(period_error, "danger")
                return redirect(url_for("ticket_detail", ticket_id=ticket.id))

            if not notes:
                flash("Descreva a atividade.", "danger")
                return redirect(url_for("ticket_detail", ticket_id=ticket.id))

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
                return redirect(url_for("ticket_detail", ticket_id=ticket.id))

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

    return render_template("ticket_detail.html", ticket=ticket, role=role)


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

    if activity.created_by_id != current_user_id:
        flash("Você só pode editar atividades lançadas por você.", "danger")
        return redirect(url_for("ticket_detail", ticket_id=ticket.id))

    if request.method == "POST":
        notes = request.form.get("notes", "").strip()
        started_at_raw = request.form.get("started_at", "")
        ended_at_raw = request.form.get("ended_at", "")

        try:
            started_at = datetime.fromisoformat(started_at_raw)
            ended_at = datetime.fromisoformat(ended_at_raw)
        except ValueError:
            flash("Datas inválidas. Use data e hora válidas.", "danger")
            return redirect(
                url_for("edit_activity", ticket_id=ticket.id, activity_id=activity.id)
            )

        period_error = validate_activity_period(started_at, ended_at)
        if period_error:
            flash(period_error, "danger")
            return redirect(
                url_for("edit_activity", ticket_id=ticket.id, activity_id=activity.id)
            )

        if not notes:
            flash("Descreva a atividade.", "danger")
            return redirect(
                url_for("edit_activity", ticket_id=ticket.id, activity_id=activity.id)
            )

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
            return redirect(
                url_for("edit_activity", ticket_id=ticket.id, activity_id=activity.id)
            )

        activity.notes = notes
        activity.started_at = started_at
        activity.ended_at = ended_at
        db.session.commit()
        flash("Atividade atualizada com sucesso.", "success")
        return redirect(url_for("ticket_detail", ticket_id=ticket.id))

    return render_template("edit_activity.html", ticket=ticket, activity=activity)


@app.cli.command("init-db")
def init_db() -> None:
    db.create_all()
    ensure_system_parameters()
    result = ensure_superuser()
    print(f"Banco inicializado. {result}")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        ensure_system_parameters()
        print(ensure_superuser())
    app.run(host="0.0.0.0", port=5000, debug=True)

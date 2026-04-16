from datetime import datetime
from functools import wraps
from email.message import EmailMessage
import smtplib
import ssl

from flask import Flask, flash, redirect, render_template, request, session, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash
from dotenv import load_dotenv
from urllib.parse import quote_plus
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

    body = (
        "Novo chamado recebido no Hope Desk.\n\n"
        f"Chamado #{ticket.id}\n"
        f"Titulo: {ticket.title}\n"
        f"Cliente: {ticket.client.name}\n"
        f"Descricao:\n{ticket.description}\n\n"
        "Acesse o sistema para atendimento."
    )
    subject = f"[Hope Desk] Novo chamado #{ticket.id}: {ticket.title}"
    return send_email(recipients, subject, body)


def notify_client_status_changed(ticket: "Ticket", old_status: str, new_status: str) -> bool:
    if not ticket.client or not ticket.client.email:
        return False

    body = (
        "O status do seu chamado foi atualizado.\n\n"
        f"Chamado #{ticket.id}\n"
        f"Titulo: {ticket.title}\n"
        f"Status anterior: {old_status}\n"
        f"Novo status: {new_status}\n\n"
        "Acesse o sistema para acompanhar."
    )
    subject = f"[Hope Desk] Atualizacao de status do chamado #{ticket.id}"
    return send_email([ticket.client.email], subject, body)


def notify_client_new_activity(ticket: "Ticket", activity: "Activity") -> bool:
    if not ticket.client or not ticket.client.email:
        return False

    technician_name = activity.created_by.name if activity.created_by else "Tecnico"
    body = (
        "Uma nova tarefa/atividade foi registrada no seu chamado.\n\n"
        f"Chamado #{ticket.id}\n"
        f"Titulo: {ticket.title}\n"
        f"Tecnico: {technician_name}\n"
        f"Inicio: {activity.started_at.strftime('%d/%m/%Y %H:%M')}\n"
        f"Fim: {activity.ended_at.strftime('%d/%m/%Y %H:%M')}\n"
        f"Descricao da atividade:\n{activity.notes}\n\n"
        "Acesse o sistema para acompanhar."
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

    year_raw = request.args.get("year", str(today.year))
    month_raw = request.args.get("month", str(today.month))

    try:
        selected_year = int(year_raw)
    except (TypeError, ValueError):
        selected_year = today.year

    try:
        selected_month = int(month_raw)
    except (TypeError, ValueError):
        selected_month = today.month

    if selected_month < 1 or selected_month > 12:
        selected_month = today.month

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

    tickets = (
        scope_query.filter(year_expr == selected_year, month_expr == selected_month)
        .order_by(Ticket.created_at.desc())
        .all()
    )
    total_hours_sum = round(sum(ticket.total_hours for ticket in tickets), 2)

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

    return render_template(
        "dashboard.html",
        tickets=tickets,
        role=role,
        months=months,
        selected_month=selected_month,
        available_years=available_years,
        selected_year=selected_year,
        status_meta=status_meta,
        total_hours_sum=total_hours_sum,
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
    result = ensure_superuser()
    print(f"Banco inicializado. {result}")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        print(ensure_superuser())
    app.run(host="0.0.0.0", port=5000, debug=True)

from datetime import datetime
from functools import wraps

from flask import Flask, flash, redirect, render_template, request, session, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-this-in-production"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///chamados.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

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

    if role == "client":
        tickets = Ticket.query.filter_by(client_id=user_id).order_by(Ticket.created_at.desc()).all()
    else:
        tickets = Ticket.query.order_by(Ticket.created_at.desc()).all()

    return render_template("dashboard.html", tickets=tickets, role=role)


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
        flash("Chamado criado com sucesso.", "success")
        return redirect(url_for("dashboard"))

    return render_template(
        "new_ticket.html",
        technicians=technicians,
        clients=clients,
        can_create_for_client=can_create_for_client,
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
                ticket.status = new_status
                db.session.commit()
                flash("Status atualizado.", "success")

        elif action == "activity":
            notes = request.form.get("notes", "").strip()
            started_at_raw = request.form.get("started_at", "")
            ended_at_raw = request.form.get("ended_at", "")

            try:
                started_at = datetime.fromisoformat(started_at_raw)
                ended_at = datetime.fromisoformat(ended_at_raw)
                if ended_at <= started_at:
                    raise ValueError("Fim deve ser maior que início")
            except ValueError:
                flash("Datas inválidas. Use data e hora válidas.", "danger")
                return redirect(url_for("ticket_detail", ticket_id=ticket.id))

            if not notes:
                flash("Descreva a atividade.", "danger")
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
            flash("Atividade registrada.", "success")

        return redirect(url_for("ticket_detail", ticket_id=ticket.id))

    return render_template("ticket_detail.html", ticket=ticket, role=role)


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

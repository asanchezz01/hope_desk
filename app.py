from datetime import datetime
from functools import wraps

from flask import Flask, flash, redirect, render_template, request, session, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

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
            if session.get("role") not in roles:
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


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        role = request.form.get("role", "client")

        if role not in {"client", "technician"}:
            flash("Perfil inválido.", "danger")
            return redirect(url_for("register"))

        if not name or not email or not password:
            flash("Preencha todos os campos.", "danger")
            return redirect(url_for("register"))

        if User.query.filter_by(email=email).first():
            flash("E-mail já cadastrado.", "warning")
            return redirect(url_for("register"))

        user = User(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            role=role,
        )
        db.session.add(user)
        db.session.commit()
        flash("Usuário cadastrado com sucesso. Faça login.", "success")
        return redirect(url_for("login"))

    return render_template("register.html")


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
@role_required("client")
def new_ticket():
    technicians = User.query.filter_by(role="technician").all()

    if request.method == "POST":
        title = request.form.get("title", "").strip()
        description = request.form.get("description", "").strip()
        technician_id = request.form.get("technician_id")

        if not title or not description:
            flash("Título e descrição são obrigatórios.", "danger")
            return redirect(url_for("new_ticket"))

        ticket = Ticket(
            title=title,
            description=description,
            client_id=session["user_id"],
            technician_id=int(technician_id) if technician_id else None,
        )
        db.session.add(ticket)
        db.session.commit()
        flash("Chamado criado com sucesso.", "success")
        return redirect(url_for("dashboard"))

    return render_template("new_ticket.html", technicians=technicians)


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
    print("Banco inicializado.")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True)

"""Axesta Dev — Release manager"""
import tkinter as tk
from tkinter import ttk, messagebox
import json, os, subprocess, sys, threading, webbrowser
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
VERSION_FILE = os.path.join(BASE, "version.json")
BUILD_YML = os.path.join(BASE, ".github", "workflows", "build.yml")

def load_version():
    try:
        with open(VERSION_FILE) as f: return json.load(f)
    except: return {"codename":"Sequoia","version":"0.1.0","channel":"release"}

def save_version(v):
    with open(VERSION_FILE,"w") as f: json.dump(v, f, indent=2)

def run_git(cmd, cwd=BASE):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    return r.stdout.strip(), r.stderr.strip(), r.returncode

class DevApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Axesta Dev")
        self.root.geometry("560x680")
        self.root.configure(bg="#0e1018")
        self.root.resizable(False, False)
        self.build()
        self.refresh_git_status()

    def build(self):
        root = self.root
        # Fonts
        F = ("SF Pro Text", 13)
        FB = ("SF Pro Text", 13, "bold")
        FS = ("SF Pro Text", 11)
        FSB = ("SF Pro Text", 11, "bold")
        FT = ("SF Pro Text", 18, "bold")

        # Header
        hdr = tk.Frame(root, bg="#08090e", height=54)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        tk.Label(hdr, text="AXESTA", font=("SF Pro Text",14,"bold"), bg="#08090e", fg="#5ec8ff").pack(side="left", padx=16, pady=14)
        tk.Label(hdr, text="Dev Console", font=F, bg="#08090e", fg="#4a6080").pack(side="left")

        # Git status
        sf = tk.LabelFrame(root, text="  Git Status  ", bg="#0e1018", fg="#4a6080",
            font=FS, bd=1, relief="solid", padx=12, pady=10)
        sf.pack(fill="x", padx=14, pady=(12,0))

        self.branch_var = tk.StringVar(value="—")
        self.status_var = tk.StringVar(value="—")
        rf = tk.Frame(sf, bg="#0e1018")
        rf.pack(fill="x")
        tk.Label(rf, text="Branch:", font=FS, bg="#0e1018", fg="#4a6080", width=10, anchor="w").grid(row=0, column=0, sticky="w")
        tk.Label(rf, textvariable=self.branch_var, font=FSB, bg="#0e1018", fg="#5ec8ff").grid(row=0, column=1, sticky="w")
        tk.Label(rf, text="Status:", font=FS, bg="#0e1018", fg="#4a6080", width=10, anchor="w").grid(row=1, column=0, sticky="w", pady=(4,0))
        tk.Label(rf, textvariable=self.status_var, font=FSB, bg="#0e1018", fg="#52e3b0").grid(row=1, column=1, sticky="w")

        btn_row = tk.Frame(sf, bg="#0e1018")
        btn_row.pack(fill="x", pady=(8,0))
        self.mk_btn(btn_row, "↻ Frissít", self.refresh_git_status, "#1e2535", "#d4dff0").pack(side="left")
        self.mk_btn(btn_row, "main → dev", lambda: self.switch_branch("dev"), "#1e2535", "#ffb454").pack(side="left", padx=(6,0))
        self.mk_btn(btn_row, "dev → main", lambda: self.switch_branch("main"), "#1e2535", "#52e3b0").pack(side="left", padx=(6,0))

        # Commit
        cf = tk.LabelFrame(root, text="  Commit  ", bg="#0e1018", fg="#4a6080",
            font=FS, bd=1, relief="solid", padx=12, pady=10)
        cf.pack(fill="x", padx=14, pady=(10,0))

        tk.Label(cf, text="Commit message:", font=FS, bg="#0e1018", fg="#4a6080", anchor="w").pack(fill="x")
        self.commit_msg = tk.Text(cf, height=3, bg="#141720", fg="#d4dff0", font=F,
            relief="flat", insertbackground="#5ec8ff", bd=0, padx=8, pady=6)
        self.commit_msg.pack(fill="x", pady=(4,8))
        self.commit_msg.insert("1.0", "feat: ")

        cbr = tk.Frame(cf, bg="#0e1018")
        cbr.pack(fill="x")
        self.mk_btn(cbr, "git add . + commit", self.do_commit, "#5ec8ff", "#08090e").pack(side="left")
        self.mk_btn(cbr, "push", self.do_push, "#1e2535", "#5ec8ff").pack(side="left", padx=(6,0))
        self.mk_btn(cbr, "add + commit + push", self.do_commit_push, "#52e3b0", "#08090e").pack(side="left", padx=(6,0))

        # Release
        rf2 = tk.LabelFrame(root, text="  Release  ", bg="#0e1018", fg="#4a6080",
            font=FS, bd=1, relief="solid", padx=12, pady=10)
        rf2.pack(fill="x", padx=14, pady=(10,0))

        ver = load_version()
        row1 = tk.Frame(rf2, bg="#0e1018")
        row1.pack(fill="x")
        tk.Label(row1, text="Codename:", font=FS, bg="#0e1018", fg="#4a6080", width=12, anchor="w").grid(row=0, column=0, sticky="w")
        self.codename_var = tk.StringVar(value=ver.get("codename","Sequoia"))
        tk.Entry(row1, textvariable=self.codename_var, bg="#141720", fg="#d4dff0", font=F,
            relief="flat", insertbackground="#5ec8ff", width=18).grid(row=0, column=1, sticky="w", padx=(0,12))
        tk.Label(row1, text="Version:", font=FS, bg="#0e1018", fg="#4a6080", width=8, anchor="w").grid(row=0, column=2, sticky="w")
        self.version_var = tk.StringVar(value=ver.get("version","0.1.0"))
        tk.Entry(row1, textvariable=self.version_var, bg="#141720", fg="#d4dff0", font=F,
            relief="flat", insertbackground="#5ec8ff", width=10).grid(row=0, column=3, sticky="w")

        row2 = tk.Frame(rf2, bg="#0e1018")
        row2.pack(fill="x", pady=(8,0))
        tk.Label(row2, text="Channel:", font=FS, bg="#0e1018", fg="#4a6080", width=12, anchor="w").grid(row=0, column=0, sticky="w")
        self.channel_var = tk.StringVar(value=ver.get("channel","release"))
        ch_frame = tk.Frame(row2, bg="#0e1018")
        ch_frame.grid(row=0, column=1, sticky="w")
        for ch in ["release","beta","dev"]:
            tk.Radiobutton(ch_frame, text=ch, variable=self.channel_var, value=ch,
                bg="#0e1018", fg="#d4dff0", selectcolor="#141720", font=FS,
                activebackground="#0e1018", activeforeground="#5ec8ff").pack(side="left", padx=(0,10))

        note_row = tk.Frame(rf2, bg="#0e1018")
        note_row.pack(fill="x", pady=(8,0))
        tk.Label(note_row, text="Release notes:", font=FS, bg="#0e1018", fg="#4a6080", anchor="w").pack(fill="x")
        self.release_notes = tk.Text(note_row, height=3, bg="#141720", fg="#d4dff0", font=FS,
            relief="flat", insertbackground="#5ec8ff", bd=0, padx=8, pady=6)
        self.release_notes.pack(fill="x", pady=(4,8))
        self.release_notes.insert("1.0", "- ")

        rbr = tk.Frame(rf2, bg="#0e1018")
        rbr.pack(fill="x")
        self.mk_btn(rbr, "💾 Mentés (version.json)", self.save_ver, "#1e2535", "#d4dff0").pack(side="left")
        self.mk_btn(rbr, "🚀 Release!", self.do_release, "#5ec8ff", "#08090e").pack(side="left", padx=(6,0))

        # Log
        lf = tk.LabelFrame(root, text="  Log  ", bg="#0e1018", fg="#4a6080",
            font=FS, bd=1, relief="solid", padx=8, pady=8)
        lf.pack(fill="both", expand=True, padx=14, pady=(10,14))
        self.log = tk.Text(lf, bg="#08090e", fg="#52e3b0", font=("Menlo",10),
            relief="flat", state="disabled", bd=0, padx=6, pady=4)
        self.log.pack(fill="both", expand=True)

    def mk_btn(self, parent, text, cmd, bg, fg):
        b = tk.Button(parent, text=text, command=cmd, bg=bg, fg=fg,
            relief="flat", font=("SF Pro Text",11,"bold"), padx=10, pady=5,
            activebackground=bg, activeforeground=fg, cursor="hand2", bd=0)
        return b

    def log_write(self, msg, color="#52e3b0"):
        self.log.config(state="normal")
        self.log.insert("end", msg+"\n")
        self.log.see("end")
        self.log.config(state="disabled")

    def refresh_git_status(self):
        out,_,_ = run_git("git branch --show-current")
        self.branch_var.set(out or "—")
        out2,_,_ = run_git("git status --short")
        count = len([l for l in out2.splitlines() if l.strip()])
        self.status_var.set(f"{count} módosított fájl" if count else "✓ tiszta")

    def switch_branch(self, branch):
        out, err, rc = run_git(f"git checkout {branch}")
        self.log_write(f"checkout {branch}: {out or err}")
        self.refresh_git_status()

    def do_commit(self):
        msg = self.commit_msg.get("1.0","end").strip()
        if not msg: messagebox.showerror("Hiba","Commit message kell!"); return
        def run():
            o1,e1,_ = run_git("git add .")
            o2,e2,rc = run_git(f'git commit -m "{msg}"')
            self.log_write(f"add: ok\ncommit: {o2 or e2}")
            self.refresh_git_status()
        threading.Thread(target=run, daemon=True).start()

    def do_push(self):
        branch,_,_ = run_git("git branch --show-current")
        def run():
            o,e,rc = run_git(f"git push origin {branch}")
            self.log_write(f"push → {branch}: {o or e}")
        threading.Thread(target=run, daemon=True).start()

    def do_commit_push(self):
        msg = self.commit_msg.get("1.0","end").strip()
        if not msg: messagebox.showerror("Hiba","Commit message kell!"); return
        branch,_,_ = run_git("git branch --show-current")
        def run():
            run_git("git add .")
            o,e,_ = run_git(f'git commit -m "{msg}"')
            self.log_write(f"commit: {o or e}")
            o2,e2,_ = run_git(f"git push origin {branch}")
            self.log_write(f"push → {branch}: {o2 or e2}")
            self.refresh_git_status()
        threading.Thread(target=run, daemon=True).start()

    def save_ver(self):
        v = {"codename": self.codename_var.get().strip(),
             "version":  self.version_var.get().strip(),
             "channel":  self.channel_var.get()}
        save_version(v)
        self.log_write(f"✓ version.json mentve: {v['codename']} {v['version']} ({v['channel']})", "#5ec8ff")

    def do_release(self):
        self.save_ver()
        v = load_version()
        codename = v["codename"]
        version  = v["version"]
        notes    = self.release_notes.get("1.0","end").strip()
        branch,_,_ = run_git("git branch --show-current")

        if branch != "main":
            if not messagebox.askyesno("Figyelem", f"Jelenleg a '{branch}' branch-en vagy.\nFolytassuk main-en?"):
                return
            run_git("git checkout main")

        def run():
            self.log_write(f"🚀 Release: {codename} {version}")
            run_git("git add .")
            run_git(f'git commit -m "release: {codename} {version}" --allow-empty')
            # Update build.yml release name
            self.update_build_yml(codename, version, notes)
            run_git("git add .")
            run_git(f'git commit -m "ci: update release name to {codename} {version}" --allow-empty')
            o,e,rc = run_git("git push origin main")
            self.log_write(f"push: {o or e}")
            if rc == 0:
                self.log_write(f"✓ Build elindult! GitHub Actions buildeli az Axesta.exe-t.", "#52e3b0")
                self.log_write(f"  Release neve: Axesta {codename} · {version}", "#5ec8ff")
            else:
                self.log_write(f"✗ Push hiba: {e}", "#f06080")
            self.refresh_git_status()
        threading.Thread(target=run, daemon=True).start()

    def update_build_yml(self, codename, version, notes):
        try:
            with open(BUILD_YML) as f: c = f.read()
            import re
            c = re.sub(
                r'name: "Axesta [^"]*"',
                f'name: "Axesta {codename} · {version}"',
                c
            )
            notes_yaml = "\n".join(f"            {l}" for l in notes.splitlines()) if notes else "            Axesta release"
            c = re.sub(
                r'body: \|.*?(?=\s+env:)',
                f'body: |\n{notes_yaml}\n          ',
                c, flags=re.DOTALL
            )
            with open(BUILD_YML,"w") as f: f.write(c)
            self.log_write("✓ build.yml frissítve", "#5ec8ff")
        except Exception as e:
            self.log_write(f"build.yml hiba: {e}", "#f06080")

    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    DevApp().run()
